import ButtonLink from "components/Button/ButtonLink";

import logoIcon from "img/logo-icon.svg";

export function AppHeaderLogo() {
  return (
    <ButtonLink to="/" className="flex items-center gap-8 px-6 py-4 text-typography-primary lg:hidden">
      <img src={logoIcon} alt="logo" className="block" />
    </ButtonLink>
  );
}
