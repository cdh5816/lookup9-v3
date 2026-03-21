import type { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/session';
import { verifySiteAccess, isSystemRole } from '@/lib/team-helper';

export const config = {
  api: { bodyParser: { sizeLimit: '10mb' } },
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: { message: 'Method not allowed' } });

  const session = await getSession(req, res);
  if (!session) return res.status(401).json({ error: { message: 'Unauthorized' } });

  const { id } = req.query;
  if (!id || typeof id !== 'string') return res.status(400).json({ error: { message: 'Site ID required' } });

  const tm = await verifySiteAccess(session.user.id, id);
  if (!tm) return res.status(403).json({ error: { message: 'Forbidden' } });

  // 시스템관리자 + COMPANY_ADMIN + MANAGER 이상만 가능
  const allowed = ['SUPER_ADMIN', 'OWNER', 'ADMIN_HR', 'ADMIN', 'MANAGER'];
  if (!allowed.includes(tm.role)) {
    return res.status(403).json({ error: { message: '생산 데이터 업로드 권한이 없습니다.' } });
  }

  try {
    const { fileData, fileName } = req.body;
    if (!fileData) return res.status(400).json({ error: { message: '파일 데이터가 필요합니다.' } });

    // base64 data URL에서 media_type과 data 분리
    const match = fileData.match(/^data:(image\/[a-z+]+|application\/pdf);base64,(.+)$/i);
    if (!match) return res.status(400).json({ error: { message: '이미지 또는 PDF 파일만 업로드 가능합니다.' } });

    const mediaType = match[1];
    const base64Data = match[2];

    // Anthropic API 호출 — 이미지에서 생산 데이터 파싱
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) return res.status(500).json({ error: { message: 'ANTHROPIC_API_KEY가 설정되지 않았습니다.' } });

    const isImage = mediaType.startsWith('image/');
    const contentBlock = isImage
      ? { type: 'image' as const, source: { type: 'base64' as const, media_type: mediaType, data: base64Data } }
      : { type: 'document' as const, source: { type: 'base64' as const, media_type: 'application/pdf', data: base64Data } };

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 4000,
        messages: [{
          role: 'user',
          content: [
            contentBlock,
            {
              type: 'text',
              text: `이 이미지는 건설 현장의 생산(발주) 물량 관리 표입니다.
정확하게 모든 데이터를 추출해주세요.

반드시 아래 JSON 형식으로만 응답하세요 (설명 없이 JSON만):
{
  "siteName": "운정4초",
  "deliveryDeadline": "2025-10-20",
  "tables": [
    {
      "label": "AL 3T",
      "orders": [
        {
          "sequence": "1차",
          "quantity": 475.69,
          "orderDate": "2025-09-08",
          "supplyDate": "2025-09-23",
          "notes": ""
        }
      ],
      "deduction": 29.86,
      "totalQuantity": 4036.69,
      "contractQuantity": 4327.00,
      "orderRate": "93.3%"
    }
  ]
}

중요 규칙:
1. siteName: 표 왼쪽 상단의 현장명 (예: "운정4초", "울주군립병원", "축구종합센터 실내체육관")
2. deliveryDeadline: "납기:" 옆의 날짜 (YYYY-MM-DD)
3. tables: 이미지에 2개 표가 나란히 있으면 tables 배열에 2개 넣기 (예: AL 3T와 GI 1.6T)
4. label: 표가 여러 개일 때 구분자 (예: "AL 3T", "GI 1.6T"). 1개면 빈 문자열
5. sequence: "1차", "2차", "8-1차", "17-3차", "샘플 1-1차", "1-1차" 등 원본 그대로
6. quantity: 숫자 (콤마 제거). 소수점 유지
7. orderDate: 발주일 (YYYY-MM-DD). 없으면 null
8. supplyDate: 공급일 (YYYY-MM-DD). 없으면 null
9. notes: 비고란 (예: "9차 8페이지", "1.6T 앵글", "10차 삭제분", "재제작분", "일반")

제외 규칙:
- "합계" 행 → totalQuantity에만 넣고 orders에 넣지 마세요
- "공제" 행 → deduction에만 넣고 orders에 넣지 마세요  
- 물량이 비어있는 행(차수만 있고 숫자 없는 행) → 건너뛰세요
- "실물1", "실물2" 행 → notes에 "실물" 표시하고 orders에 포함
- 하단 요약(계약/발주/오차/오차율) → contractQuantity, orderRate에 넣기

경과일 컬럼은 무시하세요 (자동 계산됨).`
            },
          ],
        }],
      }),
    });

    if (!response.ok) {
      const errBody = await response.text();
      console.error('Anthropic API error:', errBody);
      return res.status(500).json({ error: { message: 'AI 파싱 실패. 다시 시도해주세요.' } });
    }

    const aiResult = await response.json();
    const aiText = aiResult.content?.[0]?.text || '';

    // JSON 파싱 (마크다운 코드블록 제거)
    const cleaned = aiText.replace(/```json\s*|```\s*/g, '').trim();
    let parsed;
    try {
      parsed = JSON.parse(cleaned);
    } catch {
      return res.status(200).json({
        data: { tables: [], raw: aiText, message: '파싱 결과를 인식하지 못했습니다. 이미지가 선명한지 확인해주세요.' },
      });
    }

    // 새 포맷 (tables) 또는 구 포맷 (orders) 호환
    let tables = parsed.tables;
    if (!tables && parsed.orders) {
      tables = [{ label: '', orders: parsed.orders, totalQuantity: parsed.summary?.totalQuantity, contractQuantity: parsed.summary?.contractQuantity }];
    }

    if (!tables || !Array.isArray(tables) || tables.length === 0) {
      return res.status(200).json({
        data: { tables: [], raw: aiText, message: '추출된 데이터가 없습니다.' },
      });
    }

    // 전체 주문 수 집계
    const allOrders = tables.flatMap((t: any) => (t.orders || []).filter((o: any) => o.quantity > 0));
    if (allOrders.length === 0) {
      return res.status(200).json({
        data: { tables: [], raw: aiText, message: '유효한 데이터가 없습니다.' },
      });
    }

    // 프리뷰 반환 (confirm 후 저장)
    return res.status(200).json({
      data: {
        siteName: parsed.siteName || null,
        deliveryDeadline: parsed.deliveryDeadline || null,
        tables,
        totalCount: allOrders.length,
        message: `${allOrders.length}건의 생산 데이터가 인식되었습니다.${tables.length > 1 ? ` (${tables.length}개 테이블)` : ''}`,
      },
    });
  } catch (error: any) {
    console.error('Production upload error:', error);
    return res.status(500).json({ error: { message: error.message || 'Internal server error' } });
  }
}
