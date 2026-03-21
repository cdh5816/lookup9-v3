import { EyeIcon, EyeSlashIcon } from '@heroicons/react/24/outline';

const TogglePasswordVisibility = ({
  isPasswordVisible,
  handlePasswordVisibility,
}: {
  isPasswordVisible: boolean;
  handlePasswordVisibility: () => void;
}) => {
  return (
    <button
      onClick={handlePasswordVisibility}
      className="flex items-center absolute right-3"
      style={{ bottom: '12px', color: '#52525b' }}
      type="button"
      tabIndex={-1}
    >
      {!isPasswordVisible ? (
        <EyeIcon style={{ width: '18px', height: '18px' }} />
      ) : (
        <EyeSlashIcon style={{ width: '18px', height: '18px' }} />
      )}
    </button>
  );
};

export default TogglePasswordVisibility;
