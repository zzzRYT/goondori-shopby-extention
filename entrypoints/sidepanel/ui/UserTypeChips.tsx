import { USER_TYPE_CHARS, type UserTypeChar } from '../../../lib/display-id';

type UserTypeChipsProps = {
  selected: UserTypeChar[];
  onChange: (next: UserTypeChar[]) => void;
};

export function UserTypeChips({ selected, onChange }: UserTypeChipsProps) {
  function toggle(userType: UserTypeChar) {
    if (selected.includes(userType)) {
      onChange(selected.filter((item) => item !== userType));
      return;
    }

    onChange([...selected, userType]);
  }

  return (
    <div className="chip-group" aria-label="사용자유형">
      {USER_TYPE_CHARS.map((userType) => (
        <button
          aria-pressed={selected.includes(userType)}
          className="chip"
          data-selected={selected.includes(userType)}
          key={userType}
          onClick={() => toggle(userType)}
          type="button"
        >
          {userType}
        </button>
      ))}
    </div>
  );
}
