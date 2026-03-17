export type Theme = 'system' | 'dark' | 'light';
export type ThemesProps = {
  id: Theme;
  name: string;
  icon: React.ForwardRefExoticComponent<
    Omit<React.SVGProps<SVGSVGElement>, 'ref'> & {
      title?: string | undefined;
      titleId?: string | undefined;
    } & React.RefAttributes<SVGSVGElement>
  >;
};

export const applyTheme = (theme: Theme) => {
  const html = document.documentElement;
  switch (theme) {
    case 'dark':
      html.classList.add('dark');
      html.setAttribute('data-theme', 'black');
      html.style.colorScheme = 'dark';
      localStorage.setItem('theme', 'dark');
      break;
    case 'light':
      html.classList.remove('dark');
      html.setAttribute('data-theme', 'corporate');
      html.style.colorScheme = 'light';
      localStorage.setItem('theme', 'light');
      break;
    case 'system':
    default: {
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      if (prefersDark) {
        html.classList.add('dark');
        html.setAttribute('data-theme', 'black');
        html.style.colorScheme = 'dark';
      } else {
        html.classList.remove('dark');
        html.setAttribute('data-theme', 'corporate');
        html.style.colorScheme = 'light';
      }
      localStorage.removeItem('theme');
      break;
    }
  }
};
