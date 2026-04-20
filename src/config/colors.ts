import { ColorTree } from "lib/generateColorConfig";

export const colors: ColorTree = {
  blue: {
    100: { light: "#A4C3F9", dark: "#A4C3F9" },
    300: { light: "#7885FF", dark: "#7885FF" },
    400: { light: "#2D42FC", dark: "#2D42FC" },
    500: { light: "#3d51ff", dark: "#3d51ff" },
    600: { light: "#2d42fc", dark: "#2d42fc" },
    700: { light: "#2e3dcd", dark: "#2e3dcd" },
  },
  "cold-blue": {
    500: { light: "#3a3f79", dark: "#3a3f79" },
    700: { light: "#282b54", dark: "#282b54" },
    900: { light: "#E2E5FD", dark: "#1E223C" },
  },
  slate: {
    100: { light: "#888888", dark: "#bbbbbb" },
    400: { light: "#a3a3a3", dark: "#d1d1d1" },
    500: { light: "#bcbcbc", dark: "#888888" },
    600: { light: "#d4d4d4", dark: "#555555" },
    700: { light: "#e0e0e0", dark: "#333333" },
    750: { light: "#ebebeb", dark: "#262626" },
    800: { light: "#f2f2f2", dark: "#1a1a1a" },
    900: { light: "#fcfcfc", dark: "#121212" },
    950: { light: "#f8f8f8", dark: "#0a0a0a" },
  },
  gray: {
    50: { light: "rgba(0, 0, 0, 0.95)", dark: "rgba(255, 255, 255, 0.95)", type: "rgba" },
    100: { light: "#333333", dark: "#e7e7e9" },
    200: { light: "#555555", dark: "#cfcfd3" },
    300: { light: "#777777", dark: "#b7b8bd" },
    400: { light: "#999999", dark: "#9fa0a7" },
    500: { light: "#BBBBBB", dark: "#878891" },
    600: { light: "#DDDDDD", dark: "#70707c" },
    700: { light: "#F0F0F0", dark: "#585866" },
    800: { light: "rgba(0, 0, 0, 0.2)", dark: "rgba(255, 255, 255, 0.2)", type: "rgba" },
    900: { light: "rgba(0, 0, 0, 0.1)", dark: "rgba(255, 255, 255, 0.1)", type: "rgba" },
    950: { light: "rgba(0, 0, 0, 0.05)", dark: "rgba(255, 255, 255, 0.05)", type: "rgba" },
  },
  yellow: {
    300: { light: "#ecff3e", dark: "#f4ff82" }, // 鮮やかなベースアクセント
    500: { light: "#d4e637", dark: "#ecff3e" }, // 少し落ち着かせた/反転用の基準色
    900: { light: "#f9ffcf", dark: "#2a2e0a" }, // 最も薄い背景色・沈んだ色
  },
  red: {
    100: { light: "#EA2A46", dark: "#F9A4A5" },
    400: { light: "#ff637a", dark: "#ff637a" },
    500: { light: "#EA2A46", dark: "#FF506A" },
    700: { light: "#B33055", dark: "#B33055" },
    900: { light: "#F9E2E5", dark: "#2D192D" },
  },
  green: {
    100: { light: "#109375", dark: "#A4F9D9" },
    300: { light: "#56dba8", dark: "#56dba8" },
    400: { light: "#8CF3CB", dark: "#8CF3CB" },
    500: { light: "#109375", dark: "#0FDE8D" },
    600: { light: "#DFEFEB", dark: "#1F3445" },
    700: { light: "#0FDE8D", dark: "#0FDE8D" },
    800: { light: "#178969", dark: "#178969" },
    900: { light: "#DFFFEB", dark: "#192E38" },
  },
  white: { light: "#ffffff", dark: "#ffffff" },
  black: { light: "#000000", dark: "#000000" },
  button: {
    secondary: { light: "#E0E0E8", dark: "#ffffff0a" },
    secondaryHover: { light: "#dadce8", dark: "#ffffff1a" },
    secondaryDisabled: { light: "#E0E0E8", dark: "#c6c1c1b5" },
    primaryHover: { light: "#d8ff00", dark: "#f2ff66" },
    primaryActive: { light: "#bdde00", dark: "#e5ff00" },
  },
  fill: {
    surfaceElevated50: { light: "#EDEDF280", dark: "#1E203380" },
    surfaceElevated: { light: "#EDEDF2", dark: "#1E2033" },
    surfaceElevatedHover: { light: "#EFEFEF", dark: "#18192a" },
    surfaceHover: { light: "#696D961A", dark: "#A0A3C41A" },
    accent: { light: "#D4D4E2", dark: "#363A59" },
  },
  typography: {
    primary: { light: "#000000", dark: "#ffffff" },
    secondary: { light: "#888888", dark: "#888888" },
    inactive: { light: "#C4C4D5", dark: "#545a5e" },
  },
  stroke: {
    primary: { light: "#D4D4E2", dark: "#585858ff" },
  },
};
