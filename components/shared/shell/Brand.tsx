import app from '@/lib/app';

const Brand = () => {
  return (
    <div className="flex pt-6 shrink-0 items-center text-xl font-bold tracking-tight dark:text-gray-100">
      {app.name}
    </div>
  );
};

export default Brand;
