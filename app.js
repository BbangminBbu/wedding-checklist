const EMOJI = {
  "웨딩플래너":"🤝","본식":"⛪","스드메":"📸","예물":"💎","상견례":"🍽️","청모":"✉️",
  "신혼여행":"✈️","신혼집":"🔑","혼수·가전":"🏠","기타":"📝"
};

// [텍스트, 예상비용, 예약금]
const DEFAULT_DATA = [
  {name:"웨딩플래너", items:[
    ["플래너 계약",0,0]
  ]},
  {name:"본식", items:[
    ["웨딩홀",0,0],
    ["식대",0,0],
    ["본식 스냅",0,0],
    ["아이폰 스냅",0,0],
    ["혼주 한복",0,0],
    ["혼주 예복",0,0],
    ["혼주 헤어·메이크업",0,0],
    ["전문 사회자",0,0]
  ]},
  {name:"스드메", items:[
    ["스튜디오",0,0],
    ["드레스(본식+촬영)",0,0],
    ["신랑 예복",0,0],
    ["드레스 피팅비",0,0],
    ["헬퍼비",0,0],
    ["헤어·메이크업(본식+촬영)",0,0],
    ["헤어변형",0,0],
    ["네일아트(촬영+본식)",0,0],
    ["촬영 소품",0,0]
  ]},
  {name:"예물", items:[
    ["웨딩밴드",0,0]
  ]},
  {name:"상견례", items:[
    ["식당 예약",0,0],
    ["부모님 선물",0,0]
  ]},
  {name:"청모", items:[]},
  {name:"신혼여행", items:[
    ["항공권",0,0],
    ["환전",0,0]
  ]},
  {name:"신혼집", items:[]},
  {name:"혼수·가전", items:[]},
  {name:"기타", items:[
    ["실물 청첩장",0,0],
    ["모바일 청첩장",0,0]
  ]}
];

const SYNC_VERSION = "sheet-sync-6-final-items";
const SYNC_KEY = "wedding-checklist-sync-version";

// 예식장→본식, 청첩장→청모 이름 변경, 기타 항목에서 상견례/청모 분리, 지정된 순서로 재정렬 (한 번만 실행)
const CATEGORY_MIGRATION_VERSION = "migration-3-cheongmo";
const CATEGORY_MIGRATION_KEY = "wedding-checklist-category-migration";
const CATEGORY_ORDER = ["웨딩플래너","본식","스드메","예물","상견례","청모","신혼여행","신혼집","혼수·가전","기타"];

// 모든 예상비용·예약금을 0으로 초기화 (한 번만 실행)
const AMOUNT_RESET_VERSION = "amounts-reset-1";
const CLEAN_RESET_VERSION = "clean-share-1";
const CLEAN_RESET_KEY = "wedding-checklist-clean-reset-version";
const AMOUNT_RESET_KEY = "wedding-checklist-amount-reset-version";

function migrateCategories(categories){
  categories.forEach(cat => {
    if(cat.name === "예식장") cat.name = "본식";
    if(cat.name === "청첩장") cat.name = "청모";
  });

  const etcIdx = categories.findIndex(c => c.name === "기타");
  const sanggyeonRe = /상견례/, cheongRe = /청첩장/;
  let sanggyeonItems = [], cheongItems = [];
  if(etcIdx !== -1){
    const etc = categories[etcIdx];
    sanggyeonItems = etc.items.filter(i => sanggyeonRe.test(i.text));
    cheongItems = etc.items.filter(i => cheongRe.test(i.text));
    etc.items = etc.items.filter(i => !sanggyeonRe.test(i.text) && !cheongRe.test(i.text));
  }
  if(!categories.find(c => c.name === "상견례")){
    categories.push({name:"상견례", open:false, items:sanggyeonItems});
  }
  if(!categories.find(c => c.name === "청모")){
    categories.push({name:"청모", open:false, items:cheongItems});
  }

  categories.sort((a,b) => CATEGORY_ORDER.indexOf(a.name) - CATEGORY_ORDER.indexOf(b.name));
  return categories;
}

function applySheetSync(categories){
  const map = {};
  DEFAULT_DATA.forEach(c => map[c.name] = c.items);
  categories = categories.map((cat, ci) => {
    const newItems = map[cat.name];
    if(!newItems) return cat;
    const oldByText = {};
    cat.items.forEach(i => { oldByText[i.text] = i; });
    cat.items = newItems.map((arr, ii) => {
      const old = oldByText[arr[0]];
      return {
        id: `${ci}-${ii}-${Date.now()}-${ii}`,
        text: arr[0],
        checked: old ? !!old.checked : false,
        cost: old && old.cost !== undefined ? old.cost : (arr[1]||0),
        deposit: old && old.deposit !== undefined ? old.deposit : (arr[2]||0),
        vendor: old && old.vendor !== undefined ? old.vendor : ""
      };
    });
    return cat;
  });
  const existingNames = categories.map(c => c.name);
  DEFAULT_DATA.forEach((defCat, idx) => {
    if(!existingNames.includes(defCat.name)){
      const newCat = {
        name: defCat.name,
        open: false,
        items: defCat.items.map((arr, ii) => ({
          id: `new-${idx}-${ii}-${Date.now()}`,
          text: arr[0], checked:false, cost:arr[1]||0, deposit:arr[2]||0, vendor:""
        }))
      };
      categories.splice(idx, 0, newCat);
    }
  });
  return categories;
}

let state = null;
let weddingDate = null;
const STORAGE_KEY = "wedding-checklist-v1";
const DATE_KEY = "wedding-checklist-date-v1";

function loadState(){
  let categories = null;
  try{
    const raw = localStorage.getItem(STORAGE_KEY);
    if(raw){
      categories = JSON.parse(raw);
      categories.forEach(cat => {
        cat.items.forEach(i => { if(i.cost===undefined) i.cost=0; if(i.deposit===undefined) i.deposit=0; if(i.vendor===undefined) i.vendor=""; });
      });
    }
  }catch(e){}
  if(!categories){
    categories = DEFAULT_DATA.map((cat, ci) => ({
      name: cat.name,
      open: ci === 0,
      items: cat.items.map((arr, ii) => ({id: `${ci}-${ii}`, text: arr[0], checked:false, cost:arr[1]||0, deposit:arr[2]||0, vendor:""}))
    }));
  }
  let migrationVersion = null;
  try{ migrationVersion = localStorage.getItem(CATEGORY_MIGRATION_KEY); }catch(e){}
  if(migrationVersion !== CATEGORY_MIGRATION_VERSION){
    categories = migrateCategories(categories);
    try{ localStorage.setItem(CATEGORY_MIGRATION_KEY, CATEGORY_MIGRATION_VERSION); }catch(e){}
  }

  let syncVersion = null;
  try{ syncVersion = localStorage.getItem(SYNC_KEY); }catch(e){}
  if(syncVersion !== SYNC_VERSION){
    categories = applySheetSync(categories);
    try{ localStorage.setItem(SYNC_KEY, SYNC_VERSION); }catch(e){}
  }

  let resetVersion = null;
  try{ resetVersion = localStorage.getItem(AMOUNT_RESET_KEY); }catch(e){}
  if(resetVersion !== AMOUNT_RESET_VERSION){
    categories.forEach(cat => cat.items.forEach(i => { i.cost = 0; i.deposit = 0; }));
    try{ localStorage.setItem(AMOUNT_RESET_KEY, AMOUNT_RESET_VERSION); }catch(e){}
  }

  // 공유용 깨끗한 상태로 한 번만 초기화 (날짜, 체크, 금액, 업체명)
  let cleanVersion = null;
  try{ cleanVersion = localStorage.getItem(CLEAN_RESET_KEY); }catch(e){}
  if(cleanVersion !== CLEAN_RESET_VERSION){
    categories.forEach(cat => cat.items.forEach(i => { i.checked = false; i.cost = 0; i.deposit = 0; i.vendor = ""; }));
    try{
      localStorage.removeItem(DATE_KEY);
      localStorage.setItem(CLEAN_RESET_KEY, CLEAN_RESET_VERSION);
    }catch(e){}
  }

  return categories;
}

function loadDate(){
  try{ return localStorage.getItem(DATE_KEY) || ""; }catch(e){ return ""; }
}

function saveState(){ try{ localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }catch(e){} }
function saveDate(){ try{ localStorage.setItem(DATE_KEY, weddingDate || ""); }catch(e){} }

function formatWon(n){ return "₩" + Math.round(n||0).toLocaleString("ko-KR"); }

function renderDday(){
  const numEl = document.getElementById("ddayNum");
  const labelEl = document.getElementById("ddayLabel");
  const input = document.getElementById("weddingDateInput");
  input.value = weddingDate || "";
  if(!weddingDate){
    numEl.textContent = "D-day";
    labelEl.textContent = "예식 날짜를 설정해 주세요";
    return;
  }
  const today = new Date(); today.setHours(0,0,0,0);
  const target = new Date(weddingDate + "T00:00:00");
  const diff = Math.round((target - today) / 86400000);
  if(diff > 0){ numEl.textContent = "D-" + diff; labelEl.textContent = formatDate(target) + " 예식까지"; }
  else if(diff === 0){ numEl.textContent = "D-DAY"; labelEl.textContent = "오늘이 예식일이에요 🎉"; }
  else{ numEl.textContent = "D+" + (-diff); labelEl.textContent = formatDate(target) + " 예식을 마쳤어요"; }
}

function formatDate(d){
  return `${d.getFullYear()}.${String(d.getMonth()+1).padStart(2,"0")}.${String(d.getDate()).padStart(2,"0")}`;
}

function render(){
  renderDday();

  const wrap = document.getElementById("categories");
  wrap.innerHTML = "";
  let totalAll=0, doneAll=0, costAll=0, depositAll=0;

  state.forEach((cat, ci) => {
    const total = cat.items.length;
    const done = cat.items.filter(i=>i.checked).length;
    totalAll += total; doneAll += done;
    const pct = total ? Math.round(done/total*100) : 0;
    const catCost = cat.items.reduce((s,i)=>s+(i.cost||0),0);
    const catDeposit = cat.items.reduce((s,i)=>s+(i.deposit||0),0);
    costAll += catCost; depositAll += catDeposit;

    const card = document.createElement("div");
    card.className = "category" + (cat.open ? " open" : "");

    card.innerHTML = `
      <div class="cat-header">
        <div class="cat-title"><span class="drag-handle">⠿</span><span class="cat-emoji">${EMOJI[cat.name]||"💐"}</span>${cat.name}</div>
        <div class="cat-meta">
          <span class="cat-pct">${pct}%</span>
          <span class="chevron">▾</span>
        </div>
      </div>
      <div class="cat-mini-track"><div class="cat-mini-fill" style="width:${pct}%"></div></div>
      ${catCost ? `<div class="cat-subtotal">예상 ${formatWon(catCost)} · 예약금 ${formatWon(catDeposit)} · 잔금 ${formatWon(catCost-catDeposit)}</div>` : ""}
      <div class="cat-body">
        <div class="add-row">
          <input type="text" placeholder="새 항목 추가" data-cat="${ci}" class="new-item-input">
          <button data-cat="${ci}" class="add-btn">추가</button>
        </div>
        <ul class="items">
          ${cat.items.map((item, ii) => `
            <li class="item ${item.checked?"checked":""}" data-cat="${ci}" data-item-index="${ii}">
              <div class="item-main">
                <span class="item-drag-handle">⠿</span>
                <input type="checkbox" id="chk-${item.id}" ${item.checked?"checked":""} data-cat="${ci}" data-id="${item.id}">
                <label for="chk-${item.id}">${escapeHtml(item.text)}</label>
                <button class="edit-btn" data-cat="${ci}" data-id="${item.id}" aria-label="수정">✎</button>
                <button class="del-btn" data-cat="${ci}" data-id="${item.id}" aria-label="삭제">✕</button>
              </div>
              <div class="cost-row">
                <input type="text" placeholder="업체명" class="vendor-input" data-field="vendor" data-cat="${ci}" data-id="${item.id}" value="${escapeAttr(item.vendor||"")}">
                <input type="number" placeholder="예상비용" class="cost-input" data-field="cost" data-cat="${ci}" data-id="${item.id}" value="${item.cost||""}">
                <input type="number" placeholder="예약금" class="cost-input" data-field="deposit" data-cat="${ci}" data-id="${item.id}" value="${item.deposit||""}">
                <span class="balance-text">잔금 ${formatWon((item.cost||0)-(item.deposit||0))}</span>
              </div>
            </li>
          `).join("")}
        </ul>
      </div>
    `;
    wrap.appendChild(card);
    card.dataset.index = ci;

    card.querySelector(".cat-header").addEventListener("click", (e) => {
      if(e.target.closest(".drag-handle")) return;
      cat.open = !cat.open;
      card.classList.toggle("open");
      saveState();
    });

    card.querySelector(".drag-handle").addEventListener("pointerdown", (e) => onHandlePointerDown(e, ci));

    card.querySelectorAll(".item-drag-handle").forEach(handle => {
      const li = handle.closest(".item");
      const itemIndex = parseInt(li.dataset.itemIndex, 10);
      handle.addEventListener("pointerdown", (e) => onItemHandlePointerDown(e, ci, itemIndex));
    });

    card.querySelectorAll('input[type=checkbox]').forEach(cb => {
      cb.addEventListener("click", e => e.stopPropagation());
      cb.addEventListener("change", () => {
        const item = cat.items.find(i=>i.id===cb.dataset.id);
        item.checked = cb.checked;
        saveState();
        render();
      });
    });

    card.querySelectorAll(".del-btn").forEach(btn => {
      btn.addEventListener("click", e => {
        e.stopPropagation();
        cat.items = cat.items.filter(i=>i.id!==btn.dataset.id);
        saveState();
        render();
      });
    });

    card.querySelectorAll(".edit-btn").forEach(btn => {
      btn.addEventListener("click", e => {
        e.stopPropagation();
        const li = btn.closest(".item");
        const label = li.querySelector("label");
        const item = cat.items.find(i=>i.id===btn.dataset.id);
        const input = document.createElement("input");
        input.type = "text";
        input.className = "edit-input";
        input.value = item.text;
        label.replaceWith(input);
        input.focus();
        input.select();
        let done = false;
        const finish = (save) => {
          if(done) return;
          done = true;
          if(save){
            const newText = input.value.trim();
            if(newText) item.text = newText;
          }
          saveState();
          render();
        };
        input.addEventListener("click", ev => ev.stopPropagation());
        input.addEventListener("keydown", ev => {
          if(ev.key === "Enter") finish(true);
          if(ev.key === "Escape") finish(false);
        });
        input.addEventListener("blur", () => finish(true));
      });
    });

    card.querySelectorAll(".cost-input, .vendor-input").forEach(inp => {
      inp.addEventListener("click", e=>e.stopPropagation());
      inp.addEventListener("change", () => {
        const item = cat.items.find(i=>i.id===inp.dataset.id);
        if(inp.dataset.field === "vendor"){
          item.vendor = inp.value.trim();
        } else {
          item[inp.dataset.field] = parseFloat(inp.value) || 0;
        }
        saveState();
        render();
      });
    });

    const input = card.querySelector(".new-item-input");
    const addBtn = card.querySelector(".add-btn");
    input.addEventListener("click", e=>e.stopPropagation());
    input.addEventListener("keydown", e => { if(e.key==="Enter") addItem(ci, input.value); });
    addBtn.addEventListener("click", e => { e.stopPropagation(); addItem(ci, input.value); });
  });

  const overallPct = totalAll ? Math.round(doneAll/totalAll*100) : 0;
  document.getElementById("overallPct").textContent = overallPct + "%";
  document.getElementById("overallSub").textContent = `${doneAll} / ${totalAll} 완료`;
  document.getElementById("overallBar").style.width = overallPct + "%";

  document.getElementById("costTotal").textContent = formatWon(costAll);
  document.getElementById("depositTotal").textContent = formatWon(depositAll);
  document.getElementById("balanceTotal").textContent = formatWon(costAll - depositAll);

  renderVendorSummary();
}

function renderVendorSummary(){
  const box = document.getElementById("vendorSummary");
  if(!box) return;
  const rows = [];
  state.forEach(cat => {
    cat.items.forEach(item => {
      if(item.vendor && item.vendor.trim()){
        rows.push({ emoji: EMOJI[cat.name] || "💐", label: item.text, vendor: item.vendor });
      }
    });
  });
  if(!rows.length){
    box.innerHTML = `<div class="vendor-empty">아직 정한 업체가 없어요. 각 항목의 비용 칸에 업체명을 적으면 여기 자동으로 모여요.</div>`;
    return;
  }
  box.innerHTML = rows.map(r => `
    <div class="vendor-row">
      <span class="vendor-emoji">${r.emoji}</span>
      <div class="vendor-info">
        <div class="vendor-label">${escapeHtml(r.label)}</div>
        <div class="vendor-name">${escapeHtml(r.vendor)}</div>
      </div>
    </div>
  `).join("");
}

function addItem(catIndex, text){
  text = (text||"").trim();
  if(!text) return;
  const cat = state[catIndex];
  const newId = catIndex + "-" + Date.now();
  cat.items.push({id:newId, text, checked:false, cost:0, deposit:0, vendor:""});
  saveState();
  render();
}

function escapeHtml(str){
  const d = document.createElement("div");
  d.textContent = str;
  return d.innerHTML;
}
function escapeAttr(str){ return escapeHtml(str||"").replace(/"/g,"&quot;"); }

let dragIndex = null;

function onHandlePointerDown(e, ci){
  e.preventDefault();
  e.stopPropagation();
  dragIndex = ci;
  document.body.style.touchAction = "none";
  document.body.style.userSelect = "none";
  document.addEventListener("pointermove", onDragMove);
  document.addEventListener("pointerup", onDragEnd);
  updateDraggingClass();
}

function onDragMove(e){
  if(dragIndex === null) return;
  const el = document.elementFromPoint(e.clientX, e.clientY);
  const target = el && el.closest(".category");
  if(!target) return;
  const newIndex = parseInt(target.dataset.index, 10);
  if(isNaN(newIndex) || newIndex === dragIndex) return;
  const moved = state.splice(dragIndex, 1)[0];
  state.splice(newIndex, 0, moved);
  dragIndex = newIndex;
  render();
  updateDraggingClass();
}

function onDragEnd(){
  document.removeEventListener("pointermove", onDragMove);
  document.removeEventListener("pointerup", onDragEnd);
  document.body.style.touchAction = "";
  document.body.style.userSelect = "";
  dragIndex = null;
  saveState();
  render();
}

function updateDraggingClass(){
  document.querySelectorAll(".category").forEach(c => c.classList.remove("dragging"));
  if(dragIndex !== null){
    const el = document.querySelectorAll(".category")[dragIndex];
    if(el) el.classList.add("dragging");
  }
}

let itemDrag = null;

function onItemHandlePointerDown(e, ci, ii){
  e.preventDefault();
  e.stopPropagation();
  itemDrag = { cat: ci, index: ii };
  document.body.style.touchAction = "none";
  document.body.style.userSelect = "none";
  document.addEventListener("pointermove", onItemDragMove);
  document.addEventListener("pointerup", onItemDragEnd);
  updateItemDraggingClass();
}

function onItemDragMove(e){
  if(!itemDrag) return;
  const el = document.elementFromPoint(e.clientX, e.clientY);
  const target = el && el.closest(".item");
  if(!target) return;
  const targetCat = parseInt(target.dataset.cat, 10);
  const targetIndex = parseInt(target.dataset.itemIndex, 10);
  if(isNaN(targetCat) || isNaN(targetIndex) || targetCat !== itemDrag.cat || targetIndex === itemDrag.index) return;
  const items = state[itemDrag.cat].items;
  const moved = items.splice(itemDrag.index, 1)[0];
  items.splice(targetIndex, 0, moved);
  itemDrag.index = targetIndex;
  render();
  updateItemDraggingClass();
}

function onItemDragEnd(){
  document.removeEventListener("pointermove", onItemDragMove);
  document.removeEventListener("pointerup", onItemDragEnd);
  document.body.style.touchAction = "";
  document.body.style.userSelect = "";
  itemDrag = null;
  saveState();
  render();
}

function updateItemDraggingClass(){
  document.querySelectorAll(".item").forEach(it => it.classList.remove("dragging"));
  if(itemDrag){
    const el = document.querySelector(`.item[data-cat="${itemDrag.cat}"][data-item-index="${itemDrag.index}"]`);
    if(el) el.classList.add("dragging");
  }
}

document.getElementById("weddingDateInput").addEventListener("change", (e) => {
  weddingDate = e.target.value;
  saveDate();
  renderDday();
});

const vendorOverlay = document.getElementById("vendorModalOverlay");
document.getElementById("openVendorModal").addEventListener("click", () => {
  vendorOverlay.classList.remove("hidden");
});
document.getElementById("closeVendorModal").addEventListener("click", () => {
  vendorOverlay.classList.add("hidden");
});
vendorOverlay.addEventListener("click", (e) => {
  if(e.target === vendorOverlay) vendorOverlay.classList.add("hidden");
});

const onboardingScreen = document.getElementById("onboardingScreen");
const mainWrap = document.getElementById("mainWrap");
const onboardingDateInput = document.getElementById("onboardingDateInput");

function startApp(dateValue){
  weddingDate = dateValue;
  saveDate();
  onboardingScreen.classList.add("hidden");
  mainWrap.classList.remove("hidden");
  render();
}

const onboardingError = document.getElementById("onboardingError");
function tryStart(){
  const val = onboardingDateInput.value;
  if(!val){
    onboardingError.textContent = "결혼식 날짜를 먼저 선택해주세요 💍";
    onboardingDateInput.focus();
    return;
  }
  onboardingError.textContent = "";
  try{ startApp(val); }
  catch(err){ onboardingError.textContent = "문제가 생겼어요. 새로고침 후 다시 시도해주세요."; }
}
document.getElementById("startBtn").addEventListener("click", tryStart);
onboardingDateInput.addEventListener("change", () => { onboardingError.textContent = ""; });
onboardingDateInput.addEventListener("keydown", (e) => {
  if(e.key === "Enter") tryStart();
});

document.getElementById("backToOnboardingBtn").addEventListener("click", () => {
  onboardingDateInput.value = weddingDate || "";
  mainWrap.classList.add("hidden");
  onboardingScreen.classList.remove("hidden");
});

state = loadState();
weddingDate = loadDate();

if(weddingDate){
  onboardingScreen.classList.add("hidden");
  mainWrap.classList.remove("hidden");
  render();
} else {
  onboardingScreen.classList.remove("hidden");
}
