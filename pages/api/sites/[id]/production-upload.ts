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
              text: `이 이미지/문서는 건설 현장의 생산(발주) 데이터 표입니다.
표에서 각 행의 데이터를 추출해주세요.

반드시 아래 JSON 형식으로만 응답해주세요 (다른 텍스트 없이 JSON만):
{
  "orders": [
    {
      "sequence": "1차",
      "quantity": 475.69,
      "orderDate": "2025-09-08",
      "supplyDate": "2025-09-23",
      "notes": ""
    }
  ],
  "summary": {
    "totalQuantity": 4036.69,
    "contractQuantity": 4327.00
  }
}

규칙:
- sequence: "1차", "2차", "8-1차" 등 원본 그대로
- quantity: 숫자만 (콤마 제거)
- orderDate, supplyDate: YYYY-MM-DD 형식 (없으면 null)
- notes: 비고란 내용 (없으면 빈 문자열)
- "합계", "공제" 행은 orders에 포함하지 마세요
- summary.totalQuantity: 합계 행의 물량
- summary.contractQuantity: 계약 수량 (있으면)`
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
        data: { orders: [], raw: aiText, message: '파싱 결과를 인식하지 못했습니다. 이미지가 선명한지 확인해주세요.' },
      });
    }

    if (!parsed.orders || !Array.isArray(parsed.orders) || parsed.orders.length === 0) {
      return res.status(200).json({
        data: { orders: [], raw: aiText, message: '추출된 데이터가 없습니다.' },
      });
    }

    // 프리뷰만 반환 (아직 DB에 저장하지 않음 — confirm 후 저장)
    return res.status(200).json({
      data: {
        orders: parsed.orders,
        summary: parsed.summary || null,
        count: parsed.orders.length,
        message: `${parsed.orders.length}건의 생산 데이터가 인식되었습니다.`,
      },
    });
  } catch (error: any) {
    console.error('Production upload error:', error);
    return res.status(500).json({ error: { message: error.message || 'Internal server error' } });
  }
}
