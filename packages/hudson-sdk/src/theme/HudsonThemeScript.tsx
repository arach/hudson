import { getHudsonThemeScript, type ThemeScriptOptions } from './script';

export function HudsonThemeScript(props: ThemeScriptOptions = {}) {
  return <script dangerouslySetInnerHTML={{ __html: getHudsonThemeScript(props) }} />;
}
