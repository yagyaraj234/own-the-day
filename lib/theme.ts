export const THEME_KEY = "theme";

// Runs in <head> before first paint, so a saved choice never flashes the other theme.
// With nothing saved, <html> has no data-theme and the page follows the system setting.
export const THEME_SCRIPT = `(function(){try{var t=localStorage.getItem("${THEME_KEY}");if(t==="light"||t==="dark")document.documentElement.dataset.theme=t}catch(e){}})()`;
