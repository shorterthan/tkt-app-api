// js/task.js
// PlanBoard Task Page — LocalStorage + render Today/List/Calendar + Genre Manager

(() => {
    const LS_KEY = "planboard_tasks_v2";
    const LS_GENRES = "planboard_genres_v1";
    const GENRE_EDIT_VALUE = "__edit_genres__";

    /** @type {Array<{id:string,title:string,genre:string,start:string,end:string,assignee:"朔冶"|"翔太"|"全員",memo:string,createdAt:number,done?:boolean}>} */
    let tasks = [];
    let editingId = null;

    /** @type {Array<{name:string,color:string}>} */
    let genres = [];
    let activeGenre = "";
    let activeAssignee = "";

    // ===== Utils =====
    const $ = (sel, root = document) => root.querySelector(sel);
    const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

    const pad2 = (n) => String(n).padStart(2, "0");
    const toYMD = (d) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;

    const parseYMD = (ymd) => {
        const [y, m, d] = String(ymd || "").split("-").map(Number);
        return new Date(y, (m || 1) - 1, d || 1);
    };

    const clampYMD = (start, end) => (start > end ? [end, start] : [start, end]);
    const isBetweenInclusive = (x, a, b) => a <= x && x <= b;

    const escapeHtml = (s) =>
        String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

    const uid = () => `t_${Date.now()}_${Math.random().toString(16).slice(2)}`;
    const todayYMD = () => toYMD(new Date());

    const normalizeTaskDates = (t) => {
        const s = t.start || todayYMD();
        const e = t.end || t.start || todayYMD();
        const [a, b] = clampYMD(s, e);
        return { ...t, start: a, end: b };
    };

    const normalizeTask = (t) => {
        const x = normalizeTaskDates(t);

        // 旧データ救済（doneBy が無ければ作る）
        const doneBy = {
            "朔冶": false,
            "翔太": false,
            ...(x.doneBy || {})
        };

        return {
            done: false,     // 朔冶専用/翔太専用タスク用
            doneBy,          // 「全員」タスクのチェックだけ分離用
            ...x,
            memo: (x.memo || "").trim(),
            done: !!x.done,
            doneBy
        };
    };

    const openModal = (hash) => (location.hash = hash);
    const closeModal = () => {
        if (location.hash) history.pushState("", document.title, window.location.pathname + window.location.search);
    };

    // ===== Storage =====
    const loadTasks = () => {
        try {
            const raw = localStorage.getItem(LS_KEY);
            const arr = raw ? JSON.parse(raw) : [];
            return Array.isArray(arr) ? arr : [];
        } catch {
            return [];
        }
    };
    const saveTasks = () => localStorage.setItem(LS_KEY, JSON.stringify(tasks));

    const loadGenres = () => {
        try {
            const raw = localStorage.getItem(LS_GENRES);
            const arr = raw ? JSON.parse(raw) : [];
            return Array.isArray(arr) ? arr : [];
        } catch {
            return [];
        }
    };
    const saveGenres = () => localStorage.setItem(LS_GENRES, JSON.stringify(genres));

    // ===== Genres (default seed) =====
    const seedGenresIfEmpty = () => {
        if (genres.length) return;
        genres = [
            { name: "IT", color: "#3ddcff" },
            { name: "仕事", color: "#a56bff" },
            { name: "英語", color: "#ffce6b" },
            { name: "AI", color: "#68ffcf" },
            { name: "その他", color: "#b8bcc6" },
        ];
        saveGenres();
    };

    const getGenreColor = (name) => {
        const g = genres.find((x) => x.name === name);
        return g?.color || "#a56bff";
    };

    const hexToRgb = (hex) => {
        const h = String(hex || "").replace("#", "");
        const v = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
        const n = parseInt(v || "000000", 16);
        return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
    };

    const rgba = (hex, a) => {
        const { r, g, b } = hexToRgb(hex);
        return `rgba(${r},${g},${b},${a})`;
    };

    // ===== Update all genre selects (filter + add/edit modal) =====
    const renderGenreSelects = () => {
        // フィルタのselect（上バーのやつ）
        const filterSel = $("select[aria-label='genre filter']");
        if (filterSel) {
            const current = filterSel.value;
            filterSel.innerHTML =
                <option value="">ジャンル</option> +
                genres.map((g) => `<option value="${escapeHtml(g.name)}">${escapeHtml(g.name)}</option>`).join("") +
                `<option value="${GENRE_EDIT_VALUE}">ジャンルを編集…</option>`;
            // なるべく値維持
            if ([...filterSel.options].some((o) => o.value === current)) filterSel.value = current;
            else filterSel.value = "";
        }

        // Add modal のジャンルselect（#add-modal 内の最初の select）
        const addRoot = $("#add-modal");
        if (addRoot) {
            const addGenre = $$(".grid2 .select", addRoot)[0];
            if (addGenre) {
                const current = addGenre.value;
                addGenre.innerHTML = genres.map((g) => `<option>${escapeHtml(g.name)}</option>`).join("");
                if (genres.some((g) => g.name === current)) addGenre.value = current;
                else addGenre.value = genres[0]?.name || "その他";
            }
        }

        // Edit modal のジャンルselect（#edit-modal 内の最初の select）
        const editRoot = $("#edit-modal");
        if (editRoot) {
            const editGenre = $$(".grid2 .select", editRoot)[0];
            if (editGenre) {
                const current = editGenre.value;
                editGenre.innerHTML = genres.map((g) => `<option>${escapeHtml(g.name)}</option>`).join("");
                if (genres.some((g) => g.name === current)) editGenre.value = current;
                else editGenre.value = genres[0]?.name || "その他";
            }
        }
    };

    // ===== Genre modal UI =====
    const renderGenreModal = () => {
        const list = $("#genre-list");
        if (!list) return;

        list.innerHTML = genres
            .map((g) => {
                return `
          <div class="genreRow" data-genre="${escapeHtml(g.name)}">
            <span class="genreSwatch" style="background:${escapeHtml(g.color)};"></span>
            <input class="input genreName" data-role="name" value="${escapeHtml(g.name)}" />
            <input class="input genreColor" data-role="color" type="color" value="${escapeHtml(g.color)}" />
            <button class="btn genreDel" type="button" data-role="delete">削除</button>
          </div>
        `;
            })
            .join("");
    };

    const renameGenreEverywhere = (oldName, newName) => {
        tasks = tasks.map((t) => (t.genre === oldName ? { ...t, genre: newName } : t));
        saveTasks();
    };

    const deleteGenreEverywhere = (name) => {
        // 削除されたジャンルのタスクは「その他」へ
        const fallback = genres.find((g) => g.name === "その他") ? "その他" : (genres[0]?.name || "その他");
        tasks = tasks.map((t) => (t.genre === name ? { ...t, genre: fallback } : t));
        saveTasks();
    };

    const upsertGenre = (name, color) => {
        const idx = genres.findIndex((g) => g.name === name);
        if (idx >= 0) genres[idx] = { name, color };
        else genres.push({ name, color });
        saveGenres();
    };

    // ===== Filter =====
    const isTaskVisible = (t) => {
        const okGenre = !activeGenre || t.genre === activeGenre;

        const okAssignee =
            !activeAssignee ||
            t.assignee === activeAssignee ||
            (activeAssignee !== "" && t.assignee === "全員");
        // ↑「朔冶/翔太」選択時に「全員」も見せる仕様なら残す

        return okGenre && okAssignee;
    };

    // ===== Derived =====
    const tasksForDate = (ymd) => {
        const x = parseYMD(ymd);
        return tasks.filter((t) => {
            if (!isTaskVisible(t)) return false; // ✅ フィルタ適用

            const a = parseYMD(t.start);
            const b = parseYMD(t.end);
            return isBetweenInclusive(x, a, b);
        });
    };

    const splitByPersonForToday = () => {
        const todays = tasksForDate(todayYMD());
        const saku = [];
        const shota = [];
        for (const t of todays) {
            if (t.assignee === "全員") {
                saku.push(t);
                shota.push(t);
            } else if (t.assignee === "朔冶") saku.push(t);
            else if (t.assignee === "翔太") shota.push(t);
        }
        return { saku, shota };
    };

    const getDoneForPerson = (t, person) => {
        if (t.assignee === "全員") return !!t.doneBy?.[person];
        return !!t.done;
    };

    const setDoneForPerson = (t, person, value) => {
        if (t.assignee === "全員") {
            if (!t.doneBy) t.doneBy = { "朔冶": false, "翔太": false };
            t.doneBy[person] = !!value;
        } else {
            t.done = !!value;
        }
    };

    // ===== Render: TODAY (Todo style) =====
    const renderTodayPanel = () => {
        const panels = $$(".split .subpanel");
        if (panels.length < 2) return;

        const [panelSaku, panelShota] = panels;
        const sakuList = $(".todo", panelSaku);
        const shotaList = $(".todo", panelShota);
        const sakuCount = $(".subpanel__head .muted", panelSaku);
        const shotaCount = $(".subpanel__head .muted", panelShota);

        const { saku, shota } = splitByPersonForToday();

        // 件数は “今日のタスク数” を表示（完了含む）
        const remainingCount = (arr, person) =>
            arr.filter((t) => !getDoneForPerson(t, person)).length;

        if (sakuCount) sakuCount.textContent = `残り${remainingCount(saku, "朔冶")}件`;
        if (shotaCount) shotaCount.textContent = `残り${remainingCount(shota, "翔太")}件`;

        const sortTodo = (arr) => [
            ...arr.filter((t) => !t.done),
            ...arr.filter((t) => t.done),
        ];

        const render = (listEl, arr, person) => {
            if (!listEl) return;

            // 0件
            if (!arr.length) {
                listEl.innerHTML = `
          <li class="todoItem is-empty">
            <div class="emptyRow">
              <span class="emptyRow__dot"></span>
              <div class="emptyRow__text">今日のタスクはありません</div>
            </div>
          </li>
        `;
                return;
            }

            // 全部完了でも、リストは残して上にメッセージを出す
            const allDone = arr.every((t) => getDoneForPerson(t, person));
            const banner = allDone
                ? <li class="todoDoneBanner">今日のタスクは終了です。お疲れ様でした！</li>
                : "";
            const sorted = sortTodo(arr);

            listEl.innerHTML = banner + sorted
                .map((t) => {
                    const done = getDoneForPerson(t, person);
                    const c = getGenreColor(t.genre);

                    return `
            <li class="todoItem ${done ? "is-done" : ""}" data-id="${t.id}">
              <label class="todoCheck">
                <input type="checkbox" data-action="toggle" ${done ? "checked" : ""} />
              </label>

              <div class="todoBody">
                <div class="todoMain">
                  <div class="todoLeft">
                    <div class="todoTitle">${escapeHtml(t.title)}</div>
                    ${(t.memo || "").trim() ? <div class="todoMeta">${escapeHtml(t.memo.trim())}</div> : ""}
                  </div>

                  <div class="todoRight">
                    <span class="tag"
                      style="border-color:${rgba(c, 0.22)}; background:${rgba(c, 0.10)}; color:rgba(255,255,255,0.82);">
                      ${escapeHtml(t.genre)}
                    </span>

                    <span class="assignee ${t.assignee === "朔冶" ? "assignee--saku" : t.assignee === "翔太" ? "assignee--shota" : "assignee--all"}">
                      ${escapeHtml(t.assignee)}
                    </span>
                  </div>
                </div>
              </div>

              <div class="todoActions">
                <button class="iconMini" type="button" data-action="edit">編集</button>
              </div>
            </li>
          `;
                })
                .join("");
        }
        render(sakuList, saku, "朔冶");
        render(shotaList, shota, "翔太");
    };

    // ===== Render: LIST =====
    const renderListView = () => {
        const body = $(".view--list .table__body");
        if (!body) return;

        // ✅ フィルタ適用
        const filtered = tasks.filter(isTaskVisible);

        const sorted = [...filtered].sort((a, b) =>
            a.start === b.start ? a.createdAt - b.createdAt : a.start.localeCompare(b.start)
        );

        const today = parseYMD(todayYMD());

        body.innerHTML = sorted.map((t) => {
            const start = parseYMD(t.start);
            const end = parseYMD(t.end);

            let hint = "";
            if (isBetweenInclusive(today, start, end)) hint = "今日";
            else if (today < start) hint = `あと${Math.round((start - today) / 86400000)}日`;
            else hint = "終了";

            const c = getGenreColor(t.genre);

            return `
        <article class="tr" data-id="${t.id}">
          <!-- ===== PC用：今までの表レイアウト ===== -->
          <div class="trDesk">
            <div class="td td--title">
              <div class="titleMain">${escapeHtml(t.title)}</div>
              ${t.memo ? <div class="titleSub">${escapeHtml(t.memo)}</div> : ``}
            </div>

            <div class="td">
              <span class="tag"
                style="border-color:${rgba(c, 0.22)}; background:${rgba(c, 0.10)}; color:rgba(255,255,255,0.82);">
                ${escapeHtml(t.genre)}
              </span>
            </div>

            <div class="td">
              <span class="assignee ${t.assignee === "朔冶" ? "assignee--saku" : t.assignee === "翔太" ? "assignee--shota" : "assignee--all"}">
                ${escapeHtml(t.assignee)}
              </span>
            </div>

            <div class="td td--date">
              <span class="dateRange">${escapeHtml(t.start)} → ${escapeHtml(t.end)}</span>
              <span class="dateHint">${escapeHtml(hint)}</span>
            </div>

            <div class="td td--ops">
              <button class="btn btn--tiny btn--ghost" type="button" data-action="edit">編集</button>
            </div>
          </div>

          <!-- ===== スマホ用：今日のタスク風 + 下段に日付/ヒント ===== -->
          <div class="trMob">
            <div class="trMob__top">
              <div class="todoMain">
                <div class="todoLeft">
                  <div class="todoTitle">${escapeHtml(t.title)}</div>
                  ${t.memo ? <div class="todoMeta">${escapeHtml(t.memo)}</div> : ``}
                </div>

                <div class="todoRight">
                  <span class="tag"
                    style="border-color:${rgba(c, 0.22)}; background:${rgba(c, 0.10)}; color:rgba(255,255,255,0.82);">
                    ${escapeHtml(t.genre)}
                  </span>

                  <span class="assignee ${t.assignee === "朔冶" ? "assignee--saku" : t.assignee === "翔太" ? "assignee--shota" : "assignee--all"}">
                    ${escapeHtml(t.assignee)}
                  </span>

                  <button class="btn btn--tiny btn--ghost" type="button" data-action="edit">編集</button>
                </div>
              </div>
            </div>

            <div class="trMob__bottom">
              <div class="trMob__dates">
                <div class="dateRange">${escapeHtml(t.start)} → ${escapeHtml(t.end)}</div>
              </div>
              <div class="trMob__hint">
                <div class="dateHint">${escapeHtml(hint)}</div>
              </div>
            </div>
          </div>
        </article>
      `;
        }).join("");
    };

    // ===== Render: CALENDAR =====
    let calYear, calMonth;

    const renderCalendar = () => {
        const grid = $(".view--cal .cal__grid");
        const monthLabel = $(".view--cal .cal__month");
        if (!grid || !monthLabel) return;

        const first = new Date(calYear, calMonth, 1);
        const last = new Date(calYear, calMonth + 1, 0);
        const daysInMonth = last.getDate();

        monthLabel.textContent = `${first.toLocaleString("en-US", { month: "short" })} ${calYear}`;

        const firstDow = first.getDay();
        const leading = (firstDow + 6) % 7;
        const prevLast = new Date(calYear, calMonth, 0).getDate();

        const todayKey = todayYMD();
        const cells = [];

        for (let i = 0; i < 42; i++) {
            const dayNum = i - leading + 1;
            let cellDate;
            let muted = false;

            if (dayNum <= 0) {
                muted = true;
                cellDate = new Date(calYear, calMonth - 1, prevLast + dayNum);
            } else if (dayNum > daysInMonth) {
                muted = true;
                cellDate = new Date(calYear, calMonth + 1, dayNum - daysInMonth);
            } else {
                cellDate = new Date(calYear, calMonth, dayNum);
            }

            const key = toYMD(cellDate);
            const isToday = key === todayKey;
            const dayTasks = tasksForDate(key);
            const shown = dayTasks.slice(0, 2);
            const rest = dayTasks.length - shown.length;

            const evHtml = shown
                .map((t) => {
                    const label = t.title.length > 8 ? t.title.slice(0, 8) + "…" : t.title;
                    const c = getGenreColor(t.genre);
                    return `
            <a class="ev" href="#edit-modal" data-ev-id="${t.id}"
              style="border-color:${rgba(c, 0.22)}; background:${rgba(c, 0.10)};">
              <span class="ev__dot" style="background:${c}; box-shadow:0 0 0 4px ${rgba(c, 0.12)};"></span>
              ${escapeHtml(label)}
            </a>
          `;
                })
                .join("");

            cells.push(`
        <div class="day ${muted ? "day--muted" : ""} ${isToday ? "day--today" : ""}" data-date="${key}">
          <div class="day__n">${cellDate.getDate()}</div>
          ${evHtml}
          ${rest > 0 ? <div class="hint">＋${rest}件</div> : ""}
        </div>
      `);
        }

        grid.innerHTML = cells.join("");
    };

    // ===== Modal elements =====
    const getAddModalEls = () => {
        const root = $("#add-modal");
        if (!root) return null;

        const title = $(".row .input", root);
        const selects = $$(".grid2 .select", root);
        const genre = selects[0];
        const assignee = selects[1];
        const dates = $$(".grid2 .input[type='date']", root);
        const start = dates[0];
        const end = dates[1];
        const memo = $(".row .textarea", root);
        const saveBtn = $(".actions .btn[type='button']", root);

        return { root, title, genre, assignee, start, end, memo, saveBtn };
    };

    const getEditModalEls = () => {
        const root = $("#edit-modal");
        if (!root) return null;

        const title = $(".row .input", root);
        const selects = $$(".grid2 .select", root);
        const genre = selects[0];
        const assignee = selects[1];
        const dates = $$(".grid2 .input[type='date']", root);
        const start = dates[0];
        const end = dates[1];
        const memo = $(".row .textarea", root);

        const deleteBtn = $(".btn--danger", root);
        const saveBtn = $(".actions .btn[type='button']:not(.btn--danger)", root);

        return { root, title, genre, assignee, start, end, memo, deleteBtn, saveBtn };
    };

    const resetAddModal = () => {
        const m = getAddModalEls();
        if (!m) return;
        m.title.value = "";
        m.genre.value = genres[0]?.name || "その他";
        m.assignee.value = "全員";
        const t = todayYMD();
        m.start.value = t;
        m.end.value = t;
        m.memo.value = "";
    };

    const fillEditModal = (t) => {
        const m = getEditModalEls();
        if (!m) return;
        m.title.value = t.title || "";
        m.genre.value = t.genre || (genres[0]?.name || "その他");
        m.assignee.value = t.assignee || "全員";
        m.start.value = t.start || todayYMD();
        m.end.value = t.end || t.start || todayYMD();
        m.memo.value = t.memo || "";
    };

    // ===== Actions =====
    const openEditById = (id) => {
        const t = tasks.find((x) => x.id === id);
        if (!t) return;
        editingId = id;
        fillEditModal(t);
        openModal("#edit-modal");
    };

    const deleteById = (id) => {
        const t = tasks.find((x) => x.id === id);
        if (!t) return;
        if (!confirm(`削除する？\n\n${t.title}`)) return;
        tasks = tasks.filter((x) => x.id !== id);
        saveTasks();
        rerenderAll();
    };

    // ===== Bind =====
    const bindStaticEvents = () => {
        // Add modal save
        const add = getAddModalEls();
        add?.saveBtn?.addEventListener("click", () => {
            const title = add.title.value.trim();
            if (!title) return alert("タイトルを入力してね");

            const t = normalizeTaskDates({
                id: uid(),
                title,
                genre: (add.genre.value || "その他").trim(),
                assignee: (add.assignee.value || "全員").trim(),
                start: add.start.value || todayYMD(),
                end: add.end.value || add.start.value || todayYMD(),
                memo: (add.memo.value || "").trim(),
                createdAt: Date.now(),
                done: false,
            });

            tasks.push(t);
            saveTasks();
            rerenderAll();
            closeModal();
            resetAddModal();
        });

        // Edit modal save/delete
        const edit = getEditModalEls();
        edit?.saveBtn?.addEventListener("click", () => {
            if (!editingId) return;

            const idx = tasks.findIndex((x) => x.id === editingId);
            if (idx < 0) return;

            const title = edit.title.value.trim();
            if (!title) return alert("タイトルを入力してね");

            tasks[idx] = normalizeTaskDates({
                ...tasks[idx],
                title,
                genre: (edit.genre.value || "その他").trim(),
                assignee: (edit.assignee.value || "全員").trim(),
                start: edit.start.value || todayYMD(),
                end: edit.end.value || edit.start.value || todayYMD(),
                memo: (edit.memo.value || "").trim(),
            });

            saveTasks();
            rerenderAll();
            closeModal();
        });

        edit?.deleteBtn?.addEventListener("click", () => {
            if (!editingId) return;
            deleteById(editingId);
            closeModal();
            editingId = null;
        });

        // Add opened
        $("a.btn[href='#add-modal']")?.addEventListener("click", () => resetAddModal());

        // Calendar nav
        const calRoot = $(".view--cal .cal");
        if (calRoot) {
            const navBtns = $$(".cal__nav .btn", calRoot);
            const [prevBtn, todayBtn, nextBtn] = navBtns;

            prevBtn?.addEventListener("click", () => {
                calMonth -= 1;
                if (calMonth < 0) { calMonth = 11; calYear -= 1; }
                renderCalendar();
            });

            nextBtn?.addEventListener("click", () => {
                calMonth += 1;
                if (calMonth > 11) { calMonth = 0; calYear += 1; }
                renderCalendar();
            });

            todayBtn?.addEventListener("click", () => {
                const d = new Date();
                calYear = d.getFullYear();
                calMonth = d.getMonth();
                renderCalendar();
            });
        }

        const genreSel = $("select[aria-label='genre filter']");
        genreSel?.addEventListener("change", () => {
            if (genreSel.value === GENRE_EDIT_VALUE) {
                genreSel.value = "";
                renderGenreModal();
                openModal("#genre-modal");
                return;
            }
            activeGenre = genreSel.value || "";
            renderListView();
            renderCalendar(); // ✅ 追加
            renderTodayPanel(); // 今日欄も絞りたいなら（任意）
        });

        const assigneeSel = $("select[aria-label='assignee filter']");
        assigneeSel?.addEventListener("change", () => {
            activeAssignee = assigneeSel.value || "";
            renderListView();
            renderCalendar();   // ✅ 追加
            renderTodayPanel(); // 任意（今日欄も同条件で絞るなら）
        });

        // ✅ ジャンル追加
        $("#genre-add-btn")?.addEventListener("click", () => {
            const nameEl = $("#genre-new-name");
            const colorEl = $("#genre-new-color");
            const name = (nameEl?.value || "").trim();
            const color = (colorEl?.value || "#3ddcff").trim();

            if (!name) return alert("ジャンル名を入れてね");
            if (genres.some((g) => g.name === name)) return alert("同じ名前のジャンルがある");

            genres.push({ name, color });
            saveGenres();

            nameEl.value = "";
            renderGenreSelects();
            renderGenreModal();
            rerenderAll();
        });

        // ✅ ジャンルモーダル内の変更（委譲）
        $("#genre-list")?.addEventListener("click", (e) => {
            const row = e.target.closest(".genreRow");
            if (!row) return;
            const oldName = row.getAttribute("data-genre");

            const del = e.target.closest("[data-role='delete']");
            if (del) {
                if (oldName === "その他") return alert("「その他」は削除できない");
                if (!confirm(`ジャンル「${oldName}」を削除する？\n\nこのジャンルのタスクは「その他」に移る`)) return;

                genres = genres.filter((g) => g.name !== oldName);
                deleteGenreEverywhere(oldName);
                saveGenres();

                renderGenreSelects();
                renderGenreModal();
                rerenderAll();
                return;
            }
        });

        // 入力変更（name/color）は input イベントで拾う
        $("#genre-list")?.addEventListener("input", (e) => {
            const row = e.target.closest(".genreRow");
            if (!row) return;

            const oldName = row.getAttribute("data-genre");
            const nameInput = $("[data-role='name']", row);
            const colorInput = $("[data-role='color']", row);

            const newName = (nameInput?.value || "").trim();
            const newColor = (colorInput?.value || "#3ddcff").trim();

            // 空は許さない（打ってる途中は無視）
            if (!newName) return;

            // 名前変更が被ったら戻す
            if (newName !== oldName && genres.some((g) => g.name === newName)) {
                row.classList.add("tr--focus");
                return;
            } else {
                row.classList.remove("tr--focus");
            }

            // genres 更新
            const idx = genres.findIndex((g) => g.name === oldName);
            if (idx < 0) return;

            // rename の時は tasks も更新
            if (newName !== oldName) {
                genres[idx] = { name: newName, color: newColor };
                renameGenreEverywhere(oldName, newName);
                row.setAttribute("data-genre", newName);
            } else {
                genres[idx] = { name: oldName, color: newColor };
            }

            saveGenres();
            renderGenreSelects();
            // swatch更新（軽く反映）
            $(".genreSwatch", row).style.background = newColor;

            rerenderAll();
        });
    };

    const bindDelegatedEvents = () => {
        $(".view--list .table__body")?.addEventListener("click", (e) => {
            const btn = e.target.closest("[data-action]");
            if (!btn) return;

            const row = e.target.closest(".tr");
            const id = row?.getAttribute("data-id");
            if (!id) return;

            const action = btn.getAttribute("data-action");
            if (action === "edit") openEditById(id);
            if (action === "delete") deleteById(id);
        });

        $(".card.card--glass .split")?.addEventListener("click", (e) => {
            const btn = e.target.closest("[data-action]");
            if (!btn) return;

            const li = e.target.closest(".todoItem");
            const id = li?.getAttribute("data-id");
            if (!id) return;

            if (btn.getAttribute("data-action") === "edit") openEditById(id);
        });

        $(".view--cal .cal")?.addEventListener("click", (e) => {
            const ev = e.target.closest("[data-ev-id]");
            if (!ev) return;
            const id = ev.getAttribute("data-ev-id");
            if (!id) return;
            openEditById(id);
        });

        // ✅ Todayのチェック切替（changeで拾う）
        $(".card.card--glass .split")?.addEventListener("change", (e) => {
            const cb = e.target.closest("input[type='checkbox'][data-action='toggle']");
            if (!cb) return;

            const li = e.target.closest(".todoItem");
            const id = li?.getAttribute("data-id");
            if (!id) return;

            const t = tasks.find((x) => x.id === id);
            if (!t) return;

            // ✅ どっちのパネルか判定
            const panel = e.target.closest(".subpanel");
            const person = panel?.querySelector(".badge--saku") ? "朔冶" : "翔太";

            setDoneForPerson(t, person, cb.checked);

            saveTasks();
            renderTodayPanel();
            renderListView();
            renderCalendar();
        });
    };

    const rerenderAll = () => {
        renderTodayPanel();
        renderListView();
        renderCalendar();
    };

    const init = () => {
        tasks = loadTasks().map((t) => normalizeTask(t));
        genres = loadGenres();
        seedGenresIfEmpty();

        // もし tasks に存在するのに genres に無いジャンルがあれば自動登録（保険）
        for (const t of tasks) {
            if (!genres.some((g) => g.name === t.genre)) genres.push({ name: t.genre, color: "#a56bff" });
        }
        saveGenres();

        renderGenreSelects();

        const d = new Date();
        calYear = d.getFullYear();
        calMonth = d.getMonth();

        rerenderAll();
        bindStaticEvents();
        bindDelegatedEvents();
        resetAddModal();
    };

    document.addEventListener("DOMContentLoaded", init);
})();