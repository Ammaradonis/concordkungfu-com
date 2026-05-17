document.querySelectorAll("[data-nav-toggle]").forEach((button) => {
  button.addEventListener("click", () => {
    const nav = document.querySelector("#primary-nav");
    const isOpen = nav?.getAttribute("data-open") === "true";
    nav?.setAttribute("data-open", String(!isOpen));
    button.setAttribute("aria-expanded", String(!isOpen));
  });
});

document.querySelectorAll("[data-static-form]").forEach((form) => {
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const status = form.querySelector("[data-form-status]");
    const data = new FormData(form);
    const name = data.get("name") || "Website visitor";
    const subject = encodeURIComponent(`Concord Kung Fu website inquiry from ${name}`);
    const body = encodeURIComponent(
      Array.from(data.entries())
        .filter(([, value]) => String(value).trim().length > 0)
        .map(([key, value]) => `${key}: ${value}`)
        .join("\n")
    );
    if (status) {
      status.textContent = "Opening your email app with this message.";
    }
    window.location.href = `mailto:Webmaster@Concordkungfu.com?subject=${subject}&body=${body}`;
  });
});
