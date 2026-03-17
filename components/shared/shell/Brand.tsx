import app from '@/lib/app';
import useSWR from 'swr';
import fetcher from '@/lib/fetcher';

const Brand = () => {
  const { data } = useSWR('/api/my/profile', fetcher);
  const companyDisplayName = data?.data?.companyDisplayName || app.name;

  return (
    <div className="flex flex-col pt-5 pb-1">
      <span className="block max-w-[200px] truncate text-base font-bold tracking-tight" style={{color:"var(--text-primary)"}}>
        {companyDisplayName}
      </span>
      <span className="text-[10px] font-semibold tracking-widest uppercase mt-0.5" style={{color:"var(--text-muted)"}}>
        LOOKUP9
      </span>
    </div>
  );
};

export default Brand;
