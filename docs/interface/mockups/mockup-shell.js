function toggleSelect(element) {
  const group = element.closest(".cards");
  if (!group) return;
  group.querySelectorAll(".card").forEach((card) => card.classList.remove("selected"));
  element.classList.add("selected");
}

document.addEventListener("DOMContentLoaded", () => {
  document.querySelectorAll(".card").forEach((card) => {
    card.setAttribute("role", "button");
    card.setAttribute("tabindex", "0");
    card.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        toggleSelect(card);
      }
    });
  });
});
