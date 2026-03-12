/*
 * AIRX (individual business) proprietary source.
 * Owner: AIRX / choe DONGHYUN. All rights reserved.
 */

import app from '@/lib/app';
import useSWR from 'swr';
import fetcher from '@/lib/fetcher';

const Brand = () => {
  const { data } = useSWR('/api/my/profile', fetcher);
  const companyDisplayName = data?.data?.companyDisplayName || app.name;

  return (
    <div className="flex min-w-0 shrink-0 items-center pt-6 text-xl font-bold tracking-tight dark:text-gray-100">
      <span className="block max-w-[190px] truncate lg:max-w-[220px]">{companyDisplayName}</span>
    </div>
  );
};

export default Brand;
