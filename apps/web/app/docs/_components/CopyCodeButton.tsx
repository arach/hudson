"use client";

import { useEffect } from "react";

export function CopyCodeButton() {
  useEffect(() => {
    const pres = document.querySelectorAll(".docs-prose pre");

    for (const pre of pres) {
      if (pre.querySelector(".copy-btn")) continue;

      const wrapper = document.createElement("div");
      wrapper.className = "relative group";
      pre.parentNode?.insertBefore(wrapper, pre);
      wrapper.appendChild(pre);

      const btn = document.createElement("button");
      btn.className = "copy-btn";
      btn.textContent = "Copy";
      btn.addEventListener("click", () => {
        const code = pre.querySelector("code");
        const text = code?.textContent ?? pre.textContent ?? "";
        navigator.clipboard.writeText(text).then(() => {
          btn.textContent = "Copied";
          setTimeout(() => {
            btn.textContent = "Copy";
          }, 2000);
        });
      });

      wrapper.appendChild(btn);
    }
  }, []);

  return null;
}
