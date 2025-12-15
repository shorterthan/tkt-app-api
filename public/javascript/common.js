// js/common.js
class PlanBoardCommon extends HTMLElement {
    connectedCallback() {
        const active = (this.getAttribute("active") || "").trim();

        this.innerHTML = `
      <!-- ===== Background Layer ===== -->
      <div class="bg" aria-hidden="true">
        <div class="bg__mesh"></div>
        <div class="bg__glow bg__glow--a"></div>
        <div class="bg__glow bg__glow--b"></div>
        <div class="bg__grain"></div>
      </div>

      <!-- ===== Topbar ===== -->
      <header class="topbar" role="banner">
        <div class="topbar__left">
          <a class="brand" href="./task.html" aria-label="PlanBoard Home">
            <span class="brand__mark" aria-hidden="true">PB</span>
            <span class="brand__text">
              <span class="brand__title">PlanBoard</span>
              <span class="brand__sub">of TKT</span>
            </span>
          </a>
        </div>

        <!-- PC Navigation -->
        <nav class="pcnav" aria-label="Primary navigation">
          <a class="pcnav__btn" data-nav="tasks" href="./task.html">
            <span class="pcnav__label">タスク</span>
          </a>

          <a class="pcnav__btn" data-nav="weekly" href="./weekly.html">
            <span class="pcnav__label">今週の目標</span>
          </a>

          <a class="pcnav__btn" data-nav="ideas" href="./ideas.html">
            <span class="pcnav__label">事業アイデア</span>
          </a>
        </nav>
      </header>

      <!-- ===== Spacer (Topbar height) ===== -->
      <div class="topbar-spacer" aria-hidden="true"></div>

      <!-- ===== Mobile Bottom Nav ===== -->
      <nav class="mnav" aria-label="Mobile navigation">
        <a class="mnav__btn" data-nav="tasks" href="./task.html">
          <span class="mnav__label">タスク</span>
        </a>

        <a class="mnav__btn" data-nav="weekly" href="./weekly.html">
          <span class="mnav__label">目標</span>
        </a>

        <a class="mnav__btn" data-nav="ideas" href="./ideas.html">
          <span class="mnav__label">アイデア</span>
        </a>
      </nav>

      <!-- ===== Mobile Safe Area Spacer ===== -->
      <div class="mnav-spacer" aria-hidden="true"></div>
    `;

        // active の付与（pcnav / mnav 両方）
        if (active) {
            this.querySelectorAll(`[data-nav="${active}"]`).forEach((el) => {
                el.classList.add("is-active");
            });
        }
    }
}

customElements.define("planboard-common", PlanBoardCommon);
