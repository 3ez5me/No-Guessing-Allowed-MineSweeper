import * as UI from "./elements";

export default function init() {
  UI.closeTutorial.addEventListener("click", () => {
    UI.tutorial.style.display = "none";
  });
}
