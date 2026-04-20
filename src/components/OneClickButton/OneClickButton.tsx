import cx from "classnames";
import { useEffect, useState } from "react";
import { BsFillGearFill } from "react-icons/bs";

import { useSettings } from "context/SettingsContext/SettingsContextProvider";

import Button from "components/Button/Button";

const BACKDROP_ANIMATION_DURATION = 300;

export function OneClickButton({ openSettings }: { openSettings: () => void }) {
  const { isSettingsVisible, setIsSettingsVisible } = useSettings();

  // Keep elevated z-index during backdrop fade-out animation
  const [isElevated, setIsElevated] = useState(false);
  useEffect(() => {
    if (isSettingsVisible) {
      setIsElevated(true);
    } else {
      const timeout = setTimeout(() => setIsElevated(false), BACKDROP_ANIMATION_DURATION);
      return () => clearTimeout(timeout);
    }
  }, [isSettingsVisible]);

  const handleToggleSettings = () => {
    if (isSettingsVisible) {
      setIsSettingsVisible(false);
    } else {
      openSettings();
    }
  };

  return (
    <div className={cx("relative", { "z-[1002]": isElevated })}>
      <Button
        variant="secondary"
        size="controlled"
        onClick={handleToggleSettings}
        className="size-32 !bg-vantage-base !p-0 md:size-40"
      >
        <BsFillGearFill className="size-16 p-0" />
      </Button>
    </div>
  );
}
