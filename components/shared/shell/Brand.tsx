/*
 * AIRX (individual business) proprietary source.
 * Owner: AIRX / choe DONGHYUN. All rights reserved.
 */

import app from '@/lib/app';
import useSWR from 'swr';
import fetcher from '@/lib/fetcher';

const Brand = () => {
  const { data } = useSWR('/api/my/profile', fetcher);
  const title = data?.data?.companyDisplayName || app.name;

  return (
    <div className="flex min-h-[32px] items-center pt-6 shrink-0 text-xl font-bold tracking-tight text-gray-100 break-keep leading-6">
      <span className="line-clamp-2">{title}</span>
    </div>
  );
};

export default Brand;
