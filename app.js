/* =========================================================
   সাইদার রহমান কৃষি সেবা — বীজ ও কীটনাশক ব্যবস্থাপনা
   Agricultural Management System — Seeds & Pesticides
========================================================= */

/* ===================== Firebase Config ===================== */
const firebaseConfig = {
  apiKey: "AIzaSyDmIwu2KOB2xFUgS0i_gJVnE16SUGRPIT0",
  authDomain: "shop-management-8ed81.firebaseapp.com",
  databaseURL: "https://shop-management-8ed81-default-rtdb.firebaseio.com",
  projectId: "shop-management-8ed81",
  storageBucket: "shop-management-8ed81.firebasestorage.app",
  messagingSenderId: "373363028473",
  appId: "1:373363028473:web:bfb97325de78b96ad48d28",
  measurementId: "G-H639KB0TFR"
};

const DEFAULT_SETTINGS = {
  shopName: "সাইদার রহমান কৃষি সেবা",
  shopAddress: "",
  shopPhone: "",
  invoiceFooter: "ধন্যবাদ, আবার আসবেন",
  adminUser: "admin",
  adminPass: "1234"
};

/* Sub-categories */
const SEED_SUBCATS = ["ধানের বীজ","ভুট্টার বীজ","গমের বীজ","সরিষার বীজ","সবজি বীজ","অন্যান্য বীজ"];
const PEST_SUBCATS = ["পোকানাশক","ছত্রাকনাশক","আগাছানাশক","বৃদ্ধি নিয়ন্ত্রক","অন্যান্য কীটনাশক"];

const DB_PATHS = { products:"products", sales:"sales", dues:"dues", settings:"settings" };

let db = null, firebaseReady = false;
try {
  if (window.firebase) {
    firebase.initializeApp(firebaseConfig);
    db = firebase.database();
    firebaseReady = true;
    if (firebase.analytics) firebase.analytics();
  }
} catch(e) { console.warn("Firebase init:", e); }

/* ===================== State ===================== */
const KEYS = {
  products:"agri_products", sales:"agri_sales", dues:"agri_dues",
  settings:"agri_settings", loggedIn:"agri_logged_in",
  notifRead:"agri_notif_read", notifDeleted:"agri_notif_deleted"
};

let products = getLocal(KEYS.products, []);
let sales    = getLocal(KEYS.sales, []);
let dues     = getLocal(KEYS.dues, []);
let settings = { ...DEFAULT_SETTINGS, ...getLocal(KEYS.settings, {}) };
let lastInvoice = null;
let notifications = [];
let reportFilter = "all";
let showAllHistory = false;
let notifRead    = getLocal(KEYS.notifRead, []);
let notifDeleted = getLocal(KEYS.notifDeleted, []);
let saleCart = [];
let currentSaleType = "খুচরা";   /* খুচরা | পাইকারি */
let catFilter = "all";            /* all | বীজ | কীটনাশক */
let dueFilterSearch = "";

/* ===================== Helpers ===================== */
function $(id){ return document.getElementById(id); }
function getLocal(k,fb){ try{ return JSON.parse(localStorage.getItem(k))||fb; }catch{ return fb; } }
function setLocal(k,v){ localStorage.setItem(k,JSON.stringify(v)); }
function listFromSnapshot(v){
  if(!v) return [];
  if(Array.isArray(v)) return v.filter(Boolean);
  return Object.keys(v).map(k=>({id:v[k]?.id||k,...v[k]}));
}
function money(n){ return `৳${Number(n||0).toLocaleString("en-BD")}`; }
function uid(p="id"){ return `${p}_${Date.now()}_${Math.floor(Math.random()*99999)}`; }
function todayISO(){ return new Date().toISOString().slice(0,10); }
function currentMonth(){ return new Date().toISOString().slice(0,7); }
function safeNum(v){ const n=Number(v||0); return Number.isFinite(n)?n:0; }
function safeText(v){
  return String(v??"").replace(/[&<>'"]/g, ch=>
    ({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"}[ch]));
}
function bnDate(){
  return new Date().toLocaleDateString("bn-BD",{weekday:"long",year:"numeric",month:"long",day:"numeric"});
}
function formatTime(item){
  const d=new Date(item.createdAt||item.date||Date.now());
  if(isNaN(d)) return "-";
  return d.toLocaleTimeString("en-BD",{hour:"2-digit",minute:"2-digit"});
}
function daysUntil(dateStr){
  if(!dateStr) return null;
  const today=new Date(); today.setHours(0,0,0,0);
  const target=new Date(dateStr); target.setHours(0,0,0,0);
  return Math.round((target-today)/(1000*60*60*24));
}
function showToast(msg){
  const el=$("toast"); if(!el) return alert(msg);
  el.textContent=msg; el.classList.add("show");
  setTimeout(()=>el.classList.remove("show"),2600);
}

/* ===================== Firebase Save ===================== */
async function saveNode(path,data){
  setLocal(KEYS[path]||path,data);
  if(!firebaseReady||!db) return;
  try{ await db.ref(DB_PATHS[path]).set(data); }
  catch(e){ console.error("Firebase save error:",e); }
}
async function saveSettings(){
  setLocal(KEYS.settings,settings);
  if(firebaseReady&&db){
    try{ await db.ref(DB_PATHS.settings).set(settings); }
    catch(e){ console.error("Settings save:",e); }
  }
}

/* ===================== Realtime Bind ===================== */
function bindRealtimeData(){
  if(!firebaseReady||!db){ showToast("Local mode চলছে"); return; }
  db.ref().once("value").then(snap=>{
    const all=snap.val()||{};
    if(!all.settings) db.ref(DB_PATHS.settings).set(DEFAULT_SETTINGS);
  }).catch(()=>showToast("Firebase Database Rules চেক করুন"));

  db.ref(DB_PATHS.products).on("value",snap=>{
    products=listFromSnapshot(snap.val());
    setLocal(KEYS.products,products); renderAll();
  });
  db.ref(DB_PATHS.sales).on("value",snap=>{
    sales=listFromSnapshot(snap.val()).sort((a,b)=>
      (b.createdAt||b.date||"").localeCompare(a.createdAt||a.date||""));
    setLocal(KEYS.sales,sales); renderAll();
  });
  db.ref(DB_PATHS.dues).on("value",snap=>{
    dues=listFromSnapshot(snap.val()).sort((a,b)=>
      (b.createdAt||b.date||"").localeCompare(a.createdAt||a.date||""));
    setLocal(KEYS.dues,dues); renderAll();
  });
  db.ref(DB_PATHS.settings).on("value",snap=>{
    settings={...DEFAULT_SETTINGS,...(snap.val()||{})};
    setLocal(KEYS.settings,settings);
    fillSettingsForm(); checkLogin();
  });
}

/* ===================== Init ===================== */
window.addEventListener("load",()=>{
  if($("todayDate")) $("todayDate").textContent=bnDate();
  updateSeasonLabel();
  bindRealtimeData();
  setTimeout(()=>$("loadingScreen").classList.add("hide"),1200);
  checkLogin();
  fillSettingsForm();
  renderAll();
  initPaymentMethods();
  initCatFilterTabs();
  initNavigation();
  bindFormEvents();
  bindTopbarEvents();
});

function updateSeasonLabel(){
  const m=new Date().getMonth()+1;
  let s="রবি মৌসুম";
  if(m>=3&&m<=6) s="খরিফ-১ মৌসুম";
  else if(m>=7&&m<=10) s="খরিফ-২ মৌসুম";
  const el=$("currentSeason"); if(el) el.textContent=s;
}

/* ===================== Auth ===================== */
function checkLogin(){
  const logged=localStorage.getItem(KEYS.loggedIn)==="true";
  $("loginPage").style.display=logged?"none":"flex";
  if(logged) $("app").classList.add("show");
  else $("app").classList.remove("show");
}
$("loginForm").addEventListener("submit",e=>{
  e.preventDefault();
  const u=$("username").value.trim(), p=$("password").value.trim();
  if(u===settings.adminUser && p===settings.adminPass){
    localStorage.setItem(KEYS.loggedIn,"true");
    checkLogin(); showToast("লগইন সফল ✓");
  } else {
    showToast("ইউজারনেম বা পাসওয়ার্ড ভুল");
    $("password").value=""; $("password").focus();
  }
});
$("showPass").addEventListener("click",()=>{
  const p=$("password"), icon=$("showPass").querySelector("i");
  const h=p.type==="password";
  p.type=h?"text":"password";
  if(icon) icon.className=h?"fa-regular fa-eye-slash":"fa-regular fa-eye";
});
$("logoutBtn").addEventListener("click",()=>{
  localStorage.removeItem(KEYS.loggedIn); saleCart=[];
  checkLogin(); showToast("লগআউট সম্পন্ন");
});

/* ===================== Navigation ===================== */
function initNavigation(){
  document.querySelectorAll(".sb-item, .bnb").forEach(btn=>{
    btn.addEventListener("click",()=>switchSection(btn.dataset.section));
  });
  document.querySelectorAll("[data-section-jump]").forEach(btn=>{
    btn.addEventListener("click",()=>switchSection(btn.dataset.sectionJump));
  });
}

function switchSection(id){
  document.querySelectorAll(".sec").forEach(s=>s.classList.remove("active-section"));
  const sec=$(id); if(sec) sec.classList.add("active-section");
  document.querySelectorAll(".sb-item,.bnb").forEach(b=>
    b.classList.toggle("active",b.dataset.section===id));
  const titles={
    dashboard:"ড্যাশবোর্ড", products:"পণ্য স্টক", sales:"বিক্রয়",
    dues:"বাকি / ধার", accounts:"হিসাব", reports:"রিপোর্ট", settings:"সেটিংস"
  };
  $("pageTitle").textContent=titles[id]||id;
  $("sidebar").classList.remove("open");
  document.body.classList.remove("menu-open");
  const ov=$("mobileOverlay"); if(ov) ov.classList.remove("show");
  if(id==="accounts") renderAccounts();
}

/* ===================== Topbar ===================== */
function bindTopbarEvents(){
  $("menuToggle").addEventListener("click",()=>{
    const sb=$("sidebar"), ov=$("mobileOverlay");
    sb.classList.toggle("open");
    const open=sb.classList.contains("open");
    document.body.classList.toggle("menu-open",open);
    if(ov) ov.classList.toggle("show",open);
  });
  const ov=$("mobileOverlay");
  if(ov) ov.addEventListener("click",()=>{
    $("sidebar").classList.remove("open");
    document.body.classList.remove("menu-open");
    ov.classList.remove("show");
  });
  $("notificationBtn").addEventListener("click",()=>{
    $("notificationPanel").classList.add("show");
    renderNotifList();
    notifRead=[...new Set([...notifRead,...notifications.map(n=>n.id)])];
    setLocal(KEYS.notifRead,notifRead);
    updateNotifBadge();
  });
  $("closeNotification").addEventListener("click",()=>$("notificationPanel").classList.remove("show"));
  $("notificationPanel").addEventListener("click",e=>{
    if(e.target.id==="notificationPanel") $("notificationPanel").classList.remove("show");
  });
  $("clearNotifications").addEventListener("click",()=>{
    notifDeleted=[...new Set([...notifDeleted,...notifications.map(n=>n.id)])];
    setLocal(KEYS.notifDeleted,notifDeleted);
    notifications=[]; renderNotifList(); updateNotifBadge();
  });
}

/* ===================== Notifications ===================== */
function buildNotifications(){
  notifications=[];
  const today=todayISO();
  /* Low stock */
  products.filter(p=>safeNum(p.stock)<=safeNum(p.lowStockLimit||5)).forEach(p=>{
    const id=`ls_${p.id}`;
    if(!notifDeleted.includes(id))
      notifications.push({id,type:"stock",text:`⚠️ ${p.name} — স্টক কম (${p.stock} ${p.unit||""})`});
  });
  /* Expiring within 30 days */
  products.filter(p=>p.expDate).forEach(p=>{
    const d=daysUntil(p.expDate);
    if(d!==null&&d<=30&&d>=0){
      const id=`exp_${p.id}`;
      if(!notifDeleted.includes(id))
        notifications.push({id,type:"expiry",text:`🕐 ${p.name} — ${d} দিনে মেয়াদ শেষ`});
    }
  });
  /* Due reminders */
  dues.filter(d=>safeNum(d.dueAmount)>0&&d.dueDate).forEach(d=>{
    const days=daysUntil(d.dueDate);
    if(days!==null&&days<=3){
      const id=`due_${d.id}`;
      if(!notifDeleted.includes(id)){
        const label=days<0?"মেয়াদ পেরিয়ে গেছে":days===0?"আজ আদায়":"আগামী "+days+" দিনে";
        notifications.push({id,type:"due",text:`💰 ${d.customerName} — ${money(d.dueAmount)} (${label})`});
      }
    }
  });
  updateNotifBadge();
}
function updateNotifBadge(){
  const unread=notifications.filter(n=>!notifRead.includes(n.id)).length;
  const badge=$("notificationBadge"); if(badge) badge.textContent=unread;
}
function renderNotifList(){
  const list=$("notificationList"); if(!list) return;
  if(!notifications.length){
    list.innerHTML=`<div class="notif-empty"><i class="fa-regular fa-bell-slash"></i><p>কোনো নোটিফিকেশন নেই</p></div>`;
    return;
  }
  list.innerHTML=notifications.map(n=>`
    <div class="notif-item ${notifRead.includes(n.id)?'':'unread'}">${safeText(n.text)}</div>
  `).join("");
}

/* ==================== Product Management ==================== */

function onMainCatChange(){
  const cat=$("pMainCat").value;
  const sub=$("pSubCat");
  if(cat==="বীজ"){
    sub.innerHTML=`<option value="">সাব-ক্যাটাগরি বেছে নিন</option>`+
      SEED_SUBCATS.map(s=>`<option>${safeText(s)}</option>`).join("");
    $("seedFields").style.display="";
    $("pestFields").style.display="none";
  } else if(cat==="কীটনাশক"){
    sub.innerHTML=`<option value="">সাব-ক্যাটাগরি বেছে নিন</option>`+
      PEST_SUBCATS.map(s=>`<option>${safeText(s)}</option>`).join("");
    $("seedFields").style.display="none";
    $("pestFields").style.display="";
  } else {
    sub.innerHTML=`<option value="">প্রথমে প্রধান ক্যাটাগরি বেছে নিন</option>`;
    $("seedFields").style.display="none";
    $("pestFields").style.display="none";
  }
}

function bindFormEvents(){
  $("productForm").addEventListener("submit",handleProductSubmit);
  $("productReset").addEventListener("click",resetProductForm);
  $("productSearch").addEventListener("input",renderProducts);
  $("productFilterCat").addEventListener("change",renderProducts);
  $("dueForm").addEventListener("submit",handleDueSubmit);
  $("dueSearch").addEventListener("input",e=>{ dueFilterSearch=e.target.value; renderDues(); });
  $("toggleAllHistory").addEventListener("click",()=>{
    showAllHistory=!showAllHistory;
    $("toggleAllHistory").textContent=showAllHistory?"আজকের বিক্রয়":"সব ইতিহাস";
    renderSales();
  });
  $("salesFilterType").addEventListener("change",renderSales);
  $("settingsForm").addEventListener("submit",handleSettingsSave);
  $("saleForm").addEventListener("submit",handleSaleSubmit);
  $("addSaleItemBtn").addEventListener("click",addToCart);
  if($("productDropdownSearch"))
    $("productDropdownSearch").addEventListener("input",renderProductCards);
  [$("saleQty"),$("salePrice"),$("saleDiscount")].forEach(el=>{
    if(el) el.addEventListener("input",updateCartTotal);
  });
  $("printInvoiceBtn").addEventListener("click",printInvoice);
  // Report PNG buttons
  if($("dailyPngBtn")) $("dailyPngBtn").addEventListener("click",()=>exportReportPNG("daily"));
  if($("monthlyPngBtn")) $("monthlyPngBtn").addEventListener("click",()=>exportReportPNG("monthly"));
  // Date range report download
  if($("downloadDateReportBtn")){
    $("downloadDateReportBtn").addEventListener("click",()=>{
      const start=$("reportStartDate")?.value;
      const end=$("reportEndDate")?.value;
      if(!start||!end){ showToast("শুরুর ও শেষের তারিখ নির্বাচন করুন"); return; }
      if(start>end){ showToast("শুরুর তারিখ শেষের তারিখের আগে হতে হবে"); return; }
      exportDateRangeReport(start,end);
    });
    // Set default: today
    const t=todayISO();
    if($("reportStartDate")&&!$("reportStartDate").value) $("reportStartDate").value=t;
    if($("reportEndDate")&&!$("reportEndDate").value) $("reportEndDate").value=t;
  }
  // Report filter
  document.querySelectorAll("[data-report-filter]").forEach(btn=>{
    btn.addEventListener("click",()=>{
      reportFilter=btn.dataset.reportFilter;
      document.querySelectorAll("[data-report-filter]").forEach(b=>b.classList.remove("active"));
      btn.classList.add("active");
      renderReportCards();
    });
  });
}

async function handleProductSubmit(e){
  e.preventDefault();
  const id=$("productId").value || uid("product");
  const existing=products.find(p=>p.id===id);
  const mainCat=$("pMainCat").value;
  if(!$("pName").value.trim()) return showToast("পণ্যের নাম লিখুন");
  if(!mainCat) return showToast("প্রধান ক্যাটাগরি বেছে নিন");

  const product={
    id,
    name:$("pName").value.trim(),
    brand:$("pBrand").value.trim(),
    mainCat,
    subCat:$("pSubCat").value.trim(),
    variety:$("pVariety").value.trim(),
    packSize:$("pPackSize").value.trim(),
    purchasePrice:safeNum($("pPurchase").value),
    sellingPrice:safeNum($("pSelling").value),
    wholesalePrice:safeNum($("pWholesale").value),
    stock:safeNum($("pStock").value),
    unit:$("pUnit").value.trim()||"প্যাকেট",
    lowStockLimit:safeNum($("pLimit").value)||5,
    batchNo:$("pBatch").value.trim(),
    mfgDate:$("pMfgDate").value,
    expDate:$("pExpDate").value,
    /* seed extras */
    germRate: mainCat==="বীজ"?safeNum($("pGermRate").value):"",
    season:   mainCat==="বীজ"?$("pSeason").value:"",
    cropType: mainCat==="বীজ"?$("pCropType").value.trim():"",
    /* pesticide extras */
    activeIng:mainCat==="কীটনাশক"?$("pActiveIng").value.trim():"",
    dosage:   mainCat==="কীটনাশক"?$("pDosage").value.trim():"",
    target:   mainCat==="কীটনাশক"?$("pTarget").value.trim():"",
    warning:  mainCat==="কীটনাশক"?$("pWarning").value.trim():"",
    createdAt:existing?.createdAt||new Date().toISOString(),
    updatedAt:new Date().toISOString()
  };

  if(existing) products=products.map(p=>p.id===id?product:p);
  else products=[product,...products];
  await saveNode("products",products);
  resetProductForm();
  showToast(existing?"পণ্য আপডেট হয়েছে ✓":"পণ্য যোগ হয়েছে ✓");
  renderAll();
}

function resetProductForm(){
  $("productForm").reset();
  $("productId").value="";
  $("seedFields").style.display="none";
  $("pestFields").style.display="none";
  $("pSubCat").innerHTML=`<option value="">প্রথমে প্রধান ক্যাটাগরি বেছে নিন</option>`;
}

function editProduct(id){
  const p=products.find(x=>x.id===id); if(!p) return;
  $("productId").value=p.id;
  $("pName").value=p.name;
  $("pBrand").value=p.brand||"";
  $("pMainCat").value=p.mainCat||"";
  onMainCatChange();
  $("pSubCat").value=p.subCat||"";
  $("pVariety").value=p.variety||"";
  $("pPackSize").value=p.packSize||"";
  $("pPurchase").value=p.purchasePrice;
  $("pSelling").value=p.sellingPrice;
  $("pWholesale").value=p.wholesalePrice||"";
  $("pStock").value=p.stock;
  $("pUnit").value=p.unit||"";
  $("pLimit").value=p.lowStockLimit;
  $("pBatch").value=p.batchNo||"";
  $("pMfgDate").value=p.mfgDate||"";
  $("pExpDate").value=p.expDate||"";
  if(p.mainCat==="বীজ"){
    $("pGermRate").value=p.germRate||"";
    $("pSeason").value=p.season||"";
    $("pCropType").value=p.cropType||"";
  } else if(p.mainCat==="কীটনাশক"){
    $("pActiveIng").value=p.activeIng||"";
    $("pDosage").value=p.dosage||"";
    $("pTarget").value=p.target||"";
    $("pWarning").value=p.warning||"";
  }
  switchSection("products");
  window.scrollTo({top:0,behavior:"smooth"});
  showToast("পণ্য সম্পাদনা মোড — পরিবর্তন করে সংরক্ষণ করুন");
}

async function deleteProduct(id){
  const p=products.find(x=>x.id===id);
  if(!confirm(`"${p?.name}" মুছে ফেলবেন?`)) return;
  products=products.filter(x=>x.id!==id);
  await saveNode("products",products);
  renderAll(); showToast("পণ্য মুছে গেছে");
}

function renderProducts(){
  const tbody=$("productTable"); if(!tbody) return;
  const q=($("productSearch")?.value||"").toLowerCase();
  const fc=$("productFilterCat")?.value||"";
  const filtered=products.filter(p=>{
    const match=`${p.name} ${p.brand||""} ${p.variety||""} ${p.subCat||""}`.toLowerCase().includes(q);
    const catMatch=!fc||p.mainCat===fc;
    return match&&catMatch;
  });
  const today=todayISO();
  tbody.innerHTML=filtered.map(p=>{
    const isSeed=p.mainCat==="বীজ";
    const expDays=p.expDate?daysUntil(p.expDate):null;
    const expStr=!p.expDate?"-":expDays!==null&&expDays<=30
      ?`<span class="expiry-warning">⚠️ ${p.expDate} (${expDays}d)</span>`
      :`<span class="expiry-ok">${p.expDate}</span>`;
    const stockBadge=safeNum(p.stock)<=safeNum(p.lowStockLimit)
      ?`<span class="badge red">${p.stock} ${p.unit||""}</span>`
      :`<span class="badge green">${p.stock} ${p.unit||""}</span>`;
    return `<tr>
      <td><b>${safeText(p.name)}</b>${p.variety?`<span class="variety-badge">${safeText(p.variety)}</span>`:""}${p.packSize?`<span class="variety-badge">${safeText(p.packSize)}</span>`:""}
      </td>
      <td><span class="product-type-badge ${isSeed?"seed":"pest"}">${isSeed?"🌱 বীজ":"🧪 কীটনাশক"}</span>${p.subCat?`<span class="variety-badge">${safeText(p.subCat)}</span>`:""}</td>
      <td>${p.brand?`<span class="brand-text-sm">${safeText(p.brand)}</span>`:"-"}</td>
      <td>${money(p.purchasePrice)}</td>
      <td>${money(p.sellingPrice)}</td>
      <td>${p.wholesalePrice?money(p.wholesalePrice):"-"}</td>
      <td>${stockBadge}</td>
      <td>${expStr}</td>
      <td>
        <div class="action-row">
          <button class="btn btn-sm btn-success" onclick="editProduct('${p.id}')"><i class="fa-solid fa-pen"></i></button>
          <button class="btn btn-sm btn-danger" onclick="deleteProduct('${p.id}')"><i class="fa-solid fa-trash"></i></button>
        </div>
      </td>
    </tr>`;
  }).join("")||`<tr><td colspan="9" style="text-align:center;color:var(--text-3);padding:24px">কোনো পণ্য পাওয়া যায়নি</td></tr>`;
  renderProductCards();
}

/* ===================== Sale Type & Cat Filter ===================== */
function setSaleType(type){
  currentSaleType=type;
  $("retailTypeBtn").classList.toggle("active-type",type==="খুচরা");
  $("wholesaleTypeBtn").classList.toggle("active-type",type==="পাইকারি");
  renderProductCards();
  // Update price hint
  const hint=$("salePriceHint");
  if(hint) hint.textContent=type==="পাইকারি"?"(পাইকারি মূল্য)":"(খুচরা মূল্য)";
}

function initCatFilterTabs(){
  document.querySelectorAll("[data-cat-filter]").forEach(btn=>{
    btn.addEventListener("click",()=>{
      catFilter=btn.dataset.catFilter;
      document.querySelectorAll("[data-cat-filter]").forEach(b=>b.classList.remove("active"));
      btn.classList.add("active");
      renderProductCards();
    });
  });
}

/* ===================== Product Cards (for Sale picker) ===================== */
function getSoldQtyMap(){
  const m={};
  sales.forEach(s=>{
    (s.items||[{productId:s.productId,quantity:s.quantity}]).forEach(item=>{
      m[item.productId]=(m[item.productId]||0)+safeNum(item.quantity);
    });
  });
  return m;
}
function getCartQtyForProduct(pid){
  return saleCart.filter(x=>x.productId===pid).reduce((s,x)=>s+safeNum(x.quantity),0);
}

function renderProductCards(){
  const list=$("productOptionList"); if(!list) return;
  const q=($("productDropdownSearch")?.value||"").toLowerCase();
  const soldMap=getSoldQtyMap();
  let filtered=[...products].filter(p=>{
    const matchQ=`${p.name} ${p.brand||""} ${p.variety||""} ${p.subCat||""}`.toLowerCase().includes(q);
    const matchCat=catFilter==="all"||p.mainCat===catFilter;
    return matchQ&&matchCat;
  }).sort((a,b)=>(soldMap[b.id]||0)-(soldMap[a.id]||0));

  list.innerHTML=filtered.map(p=>{
    const sold=soldMap[p.id]||0;
    const isLow=safeNum(p.stock)<=safeNum(p.lowStockLimit||5);
    const isSelected=$("saleProduct")?.value===p.id;
    const hotTag=sold>5?`<span class="hot-tag">🔥 জনপ্রিয়</span>`:"";
    const price=currentSaleType==="পাইকারি"&&p.wholesalePrice?p.wholesalePrice:p.sellingPrice;
    const isSeed=p.mainCat==="বীজ";
    return `<button type="button"
      class="product-card-btn ${isLow?"stock-low":""} ${isSelected?"selected":""}"
      onclick="selectProduct('${p.id}')">
      ${hotTag}
      <b>${safeText(p.name)}</b>
      <small>${isSeed?"🌱":"🧪"} ${safeText(p.subCat||p.mainCat||"")}${p.packSize?" · "+safeText(p.packSize):""}</small>
      <small>${money(price)}</small>
      <span class="stock-badge">স্টক: ${p.stock} ${p.unit||""}</span>
    </button>`;
  }).join("")||`<div style="padding:20px;text-align:center;color:var(--text-3);font-size:.83rem">কোনো পণ্য পাওয়া যায়নি</div>`;
}

function selectProduct(id){
  const p=products.find(x=>x.id===id); if(!p) return;
  $("saleProduct").value=id;
  const price=currentSaleType==="পাইকারি"&&p.wholesalePrice?p.wholesalePrice:p.sellingPrice;
  $("salePrice").value=price;
  $("saleQty").value="1";
  $("saleDiscount").value=0;
  const chip=$("selectedProductChip");
  if(chip) chip.innerHTML=`<b>${safeText(p.name)}</b>&nbsp;—&nbsp;স্টক: ${p.stock} ${p.unit||""}${p.variety?" | "+safeText(p.variety):""}`;
  renderProductCards();
  updateCartTotal();
  $("saleQty").focus();
}

function addToCart(){
  const pid=$("saleProduct")?.value;
  if(!pid) return showToast("পণ্য নির্বাচন করুন");
  const product=products.find(p=>p.id===pid);
  if(!product) return showToast("পণ্য পাওয়া যায়নি");
  const qty=safeNum($("saleQty")?.value);
  if(qty<=0||!Number.isInteger(qty)) return showToast("সঠিক পরিমাণ দিন");
  const price=safeNum($("salePrice")?.value);
  if(price<=0) return showToast("সঠিক মূল্য দিন");
  const discount=safeNum($("saleDiscount")?.value||0);
  if(discount<0) return showToast("ছাড় মাইনাস হতে পারবে না");
  if(discount>price*qty) return showToast("ছাড় বেশি হয়ে গেছে");
  const cartQty=getCartQtyForProduct(pid);
  if(safeNum(product.stock)<qty+cartQty)
    return showToast(`স্টক পর্যাপ্ত নেই (বাকি: ${safeNum(product.stock)-cartQty})`);
  const total=Math.max(0,(price*qty)-discount);
  const purchaseP=safeNum(product.purchasePrice);
  const profit=Math.max(0,((price-purchaseP)*qty)-discount);
  saleCart.push({
    productId:product.id, productName:product.name,
    mainCat:product.mainCat||"",
    quantity:qty, price, discount, total, profit,
    purchasePrice:purchaseP
  });
  $("saleProduct").value="";
  $("saleQty").value=""; $("salePrice").value=""; $("saleDiscount").value=0;
  const chip=$("selectedProductChip");
  if(chip) chip.innerHTML=`<span>কোনো পণ্য নির্বাচন হয়নি</span>`;
  renderProductCards(); renderCart();
  showToast(`${product.name} কার্টে যোগ হয়েছে`);
  return true;
}

function removeFromCart(idx){ saleCart.splice(idx,1); renderCart(); renderProductCards(); }

function renderCart(){
  const list=$("saleCartList"), badge=$("saleCartCount");
  if(badge) badge.textContent=`${saleCart.length} টি পণ্য`;
  if(!list) return;
  if(!saleCart.length){
    list.innerHTML=`<div class="cart-empty"><i class="fa-regular fa-cart-shopping"></i><p>এখনো কোনো পণ্য যোগ হয়নি</p></div>`;
    updateCartTotal(); return;
  }
  list.innerHTML=saleCart.map((item,i)=>`
    <div class="cart-item">
      <div class="cart-item-info">
        <b>${safeText(item.productName)}</b>
        <small>${item.quantity} × ${money(item.price)}${safeNum(item.discount)?` • ছাড়: ${money(item.discount)}`:""}</small>
      </div>
      <strong>${money(item.total)}</strong>
      <button type="button" class="cart-item-remove" onclick="removeFromCart(${i})"><i class="fa-solid fa-xmark"></i></button>
    </div>`).join("");
  updateCartTotal();
}

function updateCartTotal(){
  const total=saleCart.reduce((s,x)=>s+safeNum(x.total),0);
  if($("saleTotalPreview")) $("saleTotalPreview").textContent=money(total);
  if($("saleStockHint")) $("saleStockHint").textContent=saleCart.length
    ?`${saleCart.length}টি পণ্য — মোট ${money(total)}`
    :"পণ্য নির্বাচন করলে বিবরণ দেখা যাবে";
  // update partial due if open
  if($("saleMethod")?.value==="আংশিক") calcPartialDue();
}

/* Payment Methods */
function initPaymentMethods(){
  document.querySelectorAll(".pmb").forEach(btn=>{
    btn.addEventListener("click",()=>{
      document.querySelectorAll(".pmb").forEach(b=>b.classList.remove("active-method"));
      btn.classList.add("active-method");
      const val=btn.dataset.method;
      if($("saleMethod")) $("saleMethod").value=val;
      $("partialPayFields").style.display=val==="আংশিক"?"":"none";
      $("fullDueFields").style.display=val==="সম্পূর্ণ বাকি"?"":"none";
      if(val==="আংশিক") calcPartialDue();
    });
  });
}

function calcPartialDue(){
  const total=saleCart.reduce((s,x)=>s+safeNum(x.total),0);
  const paid=safeNum($("salePaidAmount")?.value||0);
  const rem=Math.max(0,total-paid);
  if($("saleRemaining")) $("saleRemaining").value=rem;
}

/* ===================== Sale Submit ===================== */
async function handleSaleSubmit(e){
  e.preventDefault();
  if(!saleCart.length&&$("saleProduct")?.value){
    if(!addToCart()) return;
  }
  if(!saleCart.length) return showToast("কমপক্ষে একটি পণ্য যোগ করুন");

  for(const item of saleCart){
    const product=products.find(p=>p.id===item.productId);
    if(!product) return showToast(`"${item.productName}" পাওয়া যায়নি`);
    const totalQtyInCart=saleCart.filter(x=>x.productId===item.productId)
      .reduce((s,x)=>s+safeNum(x.quantity),0);
    if(safeNum(product.stock)<totalQtyInCart)
      return showToast(`"${item.productName}" এর পর্যাপ্ত স্টক নেই`);
  }

  const items=saleCart.map(x=>({...x}));
  const total=items.reduce((s,x)=>s+safeNum(x.total),0);
  const profit=items.reduce((s,x)=>s+safeNum(x.profit),0);
  const totalQty=items.reduce((s,x)=>s+safeNum(x.quantity),0);
  const discount=items.reduce((s,x)=>s+safeNum(x.discount),0);
  const payMethod=$("saleMethod")?.value||"সম্পূর্ণ নগদ";
  const paidAmount=payMethod==="আংশিক"?safeNum($("salePaidAmount")?.value||0)
    :(payMethod==="সম্পূর্ণ নগদ"||payMethod==="মোবাইল ব্যাংকিং")?total:0;
  const dueDate=payMethod==="আংশিক"?$("saleDueDate")?.value
    :payMethod==="সম্পূর্ণ বাকি"?$("saleDueDateFull")?.value:"";

  // Deduct stock
  products=products.map(product=>{
    const soldQty=items.filter(x=>x.productId===product.id)
      .reduce((s,x)=>s+safeNum(x.quantity),0);
    if(!soldQty) return product;
    return{...product,stock:Math.max(0,safeNum(product.stock)-soldQty),updatedAt:new Date().toISOString()};
  });

  const sale={
    id:uid("sale"),
    saleType:currentSaleType,   /* খুচরা | পাইকারি */
    productId:items.length===1?items[0].productId:"multiple",
    productName:items.map(x=>x.productName).join(", "),
    quantity:totalQty, price:items.length===1?items[0].price:0,
    discount, total, profit, items,
    paymentMethod:payMethod,
    paidAmount, dueAmount:Math.max(0,total-paidAmount),
    customerName:($("saleCustomer")?.value||"").trim(),
    customerPhone:($("salePhone")?.value||"").trim(),
    village:($("saleVillage")?.value||"").trim(),
    note:($("saleNote")?.value||"").trim(),
    date:todayISO(), createdAt:new Date().toISOString()
  };
  sales=[sale,...sales];
  lastInvoice=sale;

  // Create due entry if needed
  if(payMethod==="সম্পূর্ণ বাকি"||payMethod==="আংশিক"){
    const dueAmt=Math.max(0,total-paidAmount);
    if(dueAmt>0){
      dues=[{
        id:uid("due"),
        customerName:sale.customerName||"অজানা ক্রেতা",
        phone:sale.customerPhone, village:sale.village,
        productName:sale.productName,
        totalAmount:total, paidAmount, dueAmount:dueAmt,
        status:"বকেয়া", dueDate:dueDate||"",
        date:todayISO(), createdAt:new Date().toISOString(),
        payments:paidAmount>0?[{amount:paidAmount,date:todayISO(),createdAt:new Date().toISOString()}]:[]
      },...dues];
      await saveNode("dues",dues);
    }
  }

  await saveNode("products",products);
  await saveNode("sales",sales);

  saleCart=[];
  $("saleForm").reset();
  $("saleProduct").value="";
  const chip=$("selectedProductChip");
  if(chip) chip.innerHTML=`<span>কোনো পণ্য নির্বাচন হয়নি</span>`;
  document.querySelectorAll(".pmb").forEach(b=>b.classList.remove("active-method"));
  const cashBtn=document.querySelector('.pmb[data-method="সম্পূর্ণ নগদ"]');
  if(cashBtn) cashBtn.classList.add("active-method");
  if($("saleMethod")) $("saleMethod").value="সম্পূর্ণ নগদ";
  $("partialPayFields").style.display="none";
  $("fullDueFields").style.display="none";
  renderCart(); renderProductCards(); renderAll();
  showToast("বিক্রয় সম্পন্ন হয়েছে ✓");
}

/* ===================== Render Sales ===================== */
function renderSales(){
  const typeFilter=$("salesFilterType")?.value||"";
  let list=showAllHistory?sales:sales.filter(s=>s.date===todayISO());
  if(typeFilter) list=list.filter(s=>s.saleType===typeFilter);

  const tbody=$("salesTable"); if(!tbody) return;
  tbody.innerHTML=list.map(s=>`
    <tr>
      <td>${s.date}<br><small style="color:var(--text-3)">${formatTime(s)}</small></td>
      <td><b>${safeText(s.productName)}</b>${s.note?`<br><small>${safeText(s.note)}</small>`:""}</td>
      <td>${s.customerName?safeText(s.customerName):"-"}${s.village?`<br><small>${safeText(s.village)}</small>`:""}</td>
      <td>${s.quantity}</td>
      <td>${money(s.total)}</td>
      <td style="color:var(--green-dark);font-weight:700">${money(s.profit)}</td>
      <td><span class="badge ${s.saleType==="পাইকারি"?"blue":"green"}">${s.saleType||"খুচরা"}</span></td>
      <td><span class="badge ${s.paymentMethod==="পরিশোধিত"||s.paymentMethod==="সম্পূর্ণ নগদ"||s.paymentMethod==="মোবাইল ব্যাংকিং"?"green":s.paymentMethod==="সম্পূর্ণ বাকি"?"red":s.paymentMethod==="আংশিক"?"orange":"green"}">${s.paymentMethod==="পরিশোধিত"?"✓ পরিশোধিত":s.paymentMethod}</span></td>
      <td>
        <div class="action-row">
          <button class="btn btn-sm btn-outline" onclick="printSaleInvoice('${s.id}')"><i class="fa-solid fa-print"></i></button>
          <button class="btn btn-sm btn-danger" onclick="deleteSale('${s.id}')"><i class="fa-solid fa-trash"></i></button>
        </div>
      </td>
    </tr>`).join("")
    ||`<tr><td colspan="9" style="text-align:center;color:var(--text-3);padding:24px">কোনো বিক্রয় পাওয়া যায়নি</td></tr>`;
}

async function deleteSale(id){
  if(!confirm("এই বিক্রয় মুছে ফেলবেন?")) return;
  sales=sales.filter(s=>s.id!==id);
  await saveNode("sales",sales);
  renderAll(); showToast("বিক্রয় মুছে গেছে");
}

/* ===================== Dues ===================== */
async function handleDueSubmit(e){
  e.preventDefault();
  const amt=safeNum($("dAmount").value);
  if(!$("dCustomer").value.trim()) return showToast("ক্রেতার নাম লিখুন");
  if(amt<=0) return showToast("বাকির পরিমাণ লিখুন");
  dues=[{
    id:uid("due"),
    customerName:$("dCustomer").value.trim(),
    phone:$("dPhone").value.trim(),
    village:$("dVillage").value.trim(),
    productName:$("dProduct").value.trim(),
    totalAmount:amt, paidAmount:0, dueAmount:amt,
    status:"বকেয়া",
    dueDate:$("dDueDate").value||"",
    date:todayISO(), createdAt:new Date().toISOString(),
    payments:[]
  },...dues];
  await saveNode("dues",dues);
  $("dueForm").reset();
  renderAll(); showToast("বাকি যোগ হয়েছে ✓");
}

async function collectDue(id){
  const d=dues.find(x=>x.id===id); if(!d) return;
  const rem=safeNum(d.dueAmount);
  const input=prompt(`"${d.customerName}" — বকেয়া: ${money(rem)}\nআদায়কৃত পরিমাণ লিখুন:`);
  if(input===null) return;
  const amt=safeNum(input);
  if(amt<=0||amt>rem) return showToast("সঠিক পরিমাণ দিন");
  const newPaid=safeNum(d.paidAmount)+amt;
  const newDue=Math.max(0,rem-amt);
  const isPaidOff=newDue<=0;

  dues=dues.map(x=>x.id===id?{
    ...x, paidAmount:newPaid, dueAmount:newDue,
    status:isPaidOff?"পরিশোধিত":"বকেয়া",
    lastPayDate:todayISO(),
    payments:[...(x.payments||[]),{amount:amt,date:todayISO(),createdAt:new Date().toISOString()}]
  }:x);

  // Update related sale payment status if fully paid
  if(isPaidOff){
    sales=sales.map(s=>{
      if((s.customerName===d.customerName||s.customerPhone===d.phone)&&safeNum(s.dueAmount)>0){
        return {...s,paymentMethod:"পরিশোধিত",dueAmount:0,paidAmount:safeNum(s.total)};
      }
      return s;
    });
    await saveNode("sales",sales);
    showToast(`${money(amt)} আদায় হয়েছে — বাকি সম্পূর্ণ পরিশোধ ✓`);
    // Auto-remove after short delay
    setTimeout(async()=>{
      dues=dues.filter(x=>x.id!==id);
      await saveNode("dues",dues);
      renderAll();
      showToast("পরিশোধিত বাকি তালিকা থেকে মুছে গেছে");
    },2000);
  } else {
    showToast(`${money(amt)} আদায় হয়েছে ✓`);
  }

  await saveNode("dues",dues);
  renderAll();
}

async function deleteDue(id){
  if(!confirm("এই বাকি রেকর্ড মুছে ফেলবেন?")) return;
  dues=dues.filter(x=>x.id!==id);
  await saveNode("dues",dues);
  renderAll(); showToast("বাকি মুছে গেছে");
}

function renderDues(){
  const list=$("dueCardsList"); if(!list) return;
  let dueList=dues;
  if(dueFilterSearch){
    const q=dueFilterSearch.toLowerCase();
    dueList=dueList.filter(d=>`${d.customerName} ${d.phone||""} ${d.village||""}`.toLowerCase().includes(q));
  }

  // Summary bar
  const activeDues=dues.filter(d=>safeNum(d.dueAmount)>0);
  const totalDueSum=activeDues.reduce((s,d)=>s+safeNum(d.dueAmount),0);
  const totalPaidSum=dues.reduce((s,d)=>s+(d.payments||[]).reduce((a,p)=>a+safeNum(p.amount),0),0);
  if($("dueSumTotal")) $("dueSumTotal").textContent=money(totalDueSum);
  if($("dueSumPaid")) $("dueSumPaid").textContent=money(totalPaidSum);
  if($("dueSumCount")) $("dueSumCount").textContent=`${activeDues.length} জন`;

  if(!dueList.length){
    list.innerHTML=`<div style="text-align:center;padding:30px;color:var(--text-3);font-size:.85rem"><i class="fa-solid fa-circle-check" style="font-size:2rem;color:var(--green-bright);display:block;margin-bottom:10px"></i>কোনো বাকি নেই</div>`;
    return;
  }

  list.innerHTML=dueList.map(d=>{
    const days=d.dueDate?daysUntil(d.dueDate):null;
    const isPaid=safeNum(d.dueAmount)<=0;
    let cardClass="", daysBadge="";

    // Days since due was created
    const createdDate=new Date(d.createdAt||d.date||Date.now());
    const daysSince=Math.floor((Date.now()-createdDate)/(1000*60*60*24));
    const daysSinceText=daysSince===0?"আজ যোগ করা":daysSince===1?"১ দিন আগে":`${daysSince} দিন আগে`;

    if(isPaid){
      cardClass="paid";
      daysBadge=`<span class="badge green">পরিশোধিত ✓</span>`;
    } else if(days!==null && days<0){
      cardClass="overdue";
      daysBadge=`<span class="due-days-badge overdue">⚠️ ${Math.abs(days)} দিন পেরিয়ে গেছে</span>`;
    } else if(days===0){
      cardClass="due-today";
      daysBadge=`<span class="due-days-badge today">🔴 আজই পরিশোধের দিন</span>`;
    } else if(days!==null && days<=3){
      cardClass="due-soon";
      daysBadge=`<span class="due-days-badge soon">🟡 ${days} দিন বাকি</span>`;
    } else {
      daysBadge=days!==null?`<span class="due-days-badge ok">${days} দিন বাকি</span>`:`<span class="badge gray">তারিখ নেই</span>`;
    }

    const progressPct=safeNum(d.totalAmount)>0?Math.min(100,(safeNum(d.paidAmount)/safeNum(d.totalAmount)*100)):0;

    return `<div class="due-card ${cardClass}">
      <div class="due-card-header">
        <div>
          <div class="due-card-name">${safeText(d.customerName)}</div>
          <div class="due-card-sub">
            ${d.phone?`<span><i class="fa-solid fa-phone" style="font-size:.65rem"></i> ${safeText(d.phone)}</span>`:""}
            ${d.village?`<span><i class="fa-solid fa-location-dot" style="font-size:.65rem"></i> ${safeText(d.village)}</span>`:""}
            <span style="color:var(--text-3);font-size:.68rem">${daysSinceText}</span>
          </div>
        </div>
        <div class="due-card-amount">
          <div class="due-total">মোট: ${money(d.totalAmount)}</div>
          <div class="due-remaining ${isPaid?'paid':''}">${money(d.dueAmount)}</div>
        </div>
      </div>

      ${d.productName?`<div style="font-size:.78rem;color:var(--text-2);margin-bottom:8px;background:var(--gray-50);padding:6px 10px;border-radius:var(--radius-sm)"><i class="fa-solid fa-box" style="color:var(--green-mid)"></i> ${safeText(d.productName)}</div>`:""}

      <div class="due-card-details">
        <div class="due-detail-item">
          <div class="dl">পরিশোধিত</div>
          <div class="dv" style="color:var(--green-dark)">${money(d.paidAmount)}</div>
        </div>
        <div class="due-detail-item">
          <div class="dl">বকেয়া</div>
          <div class="dv" style="color:${isPaid?'var(--green-dark)':'var(--soil-mid)'}">${money(d.dueAmount)}</div>
        </div>
        <div class="due-detail-item">
          <div class="dl">তারিখ</div>
          <div class="dv">${d.dueDate||d.date||"-"}</div>
        </div>
      </div>

      <!-- Progress bar -->
      <div style="height:5px;background:var(--gray-100);border-radius:3px;margin-bottom:10px;overflow:hidden">
        <div style="height:100%;width:${progressPct.toFixed(0)}%;background:linear-gradient(90deg,var(--green-dark),var(--green-bright));border-radius:3px;transition:width .4s ease"></div>
      </div>

      <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:6px;">
        <div>${daysBadge}</div>
        <div class="due-card-actions">
          ${!isPaid?`<button class="btn btn-sm btn-success" onclick="collectDue('${d.id}')"><i class="fa-solid fa-hand-holding-dollar"></i> আদায়</button>`:""}
          <button class="btn btn-sm btn-danger" onclick="deleteDue('${d.id}')"><i class="fa-solid fa-trash"></i></button>
        </div>
      </div>
    </div>`;
  }).join("");
}

/* ===================== Dashboard ===================== */
function renderDashboard(){
  const today=todayISO();
  const todaySalesList=sales.filter(s=>s.date===today);
  const totalSalesAmt=todaySalesList.reduce((s,x)=>s+safeNum(x.total),0);
  const totalProfitAmt=todaySalesList.reduce((s,x)=>s+safeNum(x.profit),0);
  const wholesaleAmt=todaySalesList.filter(s=>s.saleType==="পাইকারি").reduce((s,x)=>s+safeNum(x.total),0);
  const retailAmt=todaySalesList.filter(s=>s.saleType==="খুচরা").reduce((s,x)=>s+safeNum(x.total),0);
  const totalDueAmt=dues.filter(d=>safeNum(d.dueAmount)>0).reduce((s,d)=>s+safeNum(d.dueAmount),0);
  // today collection = payments made today across all dues
  let todayCollectedAmt=0;
  dues.forEach(d=>(d.payments||[]).forEach(p=>{ if(p.date===today) todayCollectedAmt+=safeNum(p.amount); }));
  const lowStockCount=products.filter(p=>safeNum(p.stock)<=safeNum(p.lowStockLimit||5)).length;
  const totalStockVal=products.reduce((s,p)=>s+safeNum(p.stock)*safeNum(p.purchasePrice),0);

  const wholesaleProfit=todaySalesList.filter(s=>s.saleType==="পাইকারি").reduce((s,x)=>s+safeNum(x.profit),0);
  const retailProfit=todaySalesList.filter(s=>s.saleType==="খুচরা").reduce((s,x)=>s+safeNum(x.profit),0);

  $("todaySales").textContent=money(totalSalesAmt);
  $("todayProfit").textContent=money(totalProfitAmt);
  $("wholesaleSales").textContent=money(wholesaleAmt);
  $("retailSales").textContent=money(retailAmt);
  $("totalDue").textContent=money(totalDueAmt);
  $("todayCollection").textContent=money(todayCollectedAmt);
  $("lowStockCount").textContent=lowStockCount;
  $("totalStockValue").textContent=money(totalStockVal);
  if($("wholesaleDashProfit")) $("wholesaleDashProfit").textContent=money(wholesaleProfit);
  if($("retailDashProfit")) $("retailDashProfit").textContent=money(retailProfit);

  // Recent sales
  const recentTbody=$("recentSalesTable");
  if(recentTbody){
    const recent=sales.slice(0,6);
    recentTbody.innerHTML=recent.map(s=>`
      <tr>
        <td>${formatTime(s)}</td>
        <td>${safeText(s.productName)}</td>
        <td>${s.quantity}</td>
        <td>${money(s.total)}</td>
        <td><span class="badge ${s.saleType==="পাইকারি"?"blue":"green"}">${s.saleType||"খুচরা"}</span></td>
      </tr>`).join("")||`<tr><td colspan="5" style="text-align:center;color:var(--text-3);padding:16px">কোনো বিক্রয় নেই</td></tr>`;
  }

  // Low stock list
  const lsl=$("lowStockList");
  if(lsl){
    const low=products.filter(p=>safeNum(p.stock)<=safeNum(p.lowStockLimit||5));
    lsl.innerHTML=low.length
      ?low.map(p=>`<div class="low-stock-item">
          <span class="ls-name">${p.mainCat==="বীজ"?"🌱":"🧪"} ${safeText(p.name)}</span>
          <span class="ls-stock">স্টক: ${p.stock} ${p.unit||""}</span>
        </div>`).join("")
      :`<div class="low-stock-empty"><i class="fa-solid fa-circle-check" style="color:var(--green-bright)"></i><p>সব পণ্যের স্টক ঠিক আছে</p></div>`;
  }

  // Due reminders panel
  renderDueReminders();
  // Notifications
  buildNotifications();
}

function renderDueReminders(){
  const today=todayISO();
  const tomorrow=new Date(); tomorrow.setDate(tomorrow.getDate()+1);
  const tomorrowISO=tomorrow.toISOString().slice(0,10);
  const panel=$("dueReminderPanel"), list=$("dueReminderList");
  if(!panel||!list) return;
  const pending=dues.filter(d=>safeNum(d.dueAmount)>0&&d.dueDate);
  const items=pending.map(d=>{
    const days=daysUntil(d.dueDate);
    let cls="",label="";
    if(days!==null&&days<0){cls="overdue";label="⚫ মেয়াদ পেরিয়ে গেছে";}
    else if(days===0){cls="today";label="🔴 আজ আদায় করুন";}
    else if(days===1){cls="tomorrow";label="🟠 আগামীকাল";}
    else if(days!==null&&days<=3){cls="soon";label="🟡 "+days+" দিন বাকি";}
    else return "";
    return `<div class="due-reminder ${cls}">
      <span class="reminder-dot"></span>
      <div>
        <b>${safeText(d.customerName)}</b> — ${money(d.dueAmount)}
        <div style="font-size:.75rem;color:var(--text-3);margin-top:2px">${label} · ${d.dueDate}${d.phone?` · ${safeText(d.phone)}`:""}</div>
      </div>
      <button class="btn btn-sm btn-success" style="margin-left:auto;white-space:nowrap" onclick="collectDue('${d.id}')"><i class="fa-solid fa-check"></i></button>
    </div>`;
  }).filter(Boolean).join("");
  list.innerHTML=items||`<p style="padding:8px 0;color:var(--text-3);font-size:.83rem">কোনো জরুরি বাকি নেই</p>`;
  panel.style.display=items?"":"none";
}

/* ===================== Accounts ===================== */
function renderAccounts(){
  const period=$("accPeriod")?.value||"today";
  const today=todayISO(), month=currentMonth();
  let filterFn=()=>true;
  if(period==="today") filterFn=s=>s.date===today;
  else if(period==="month") filterFn=s=>(s.date||"").startsWith(month);

  const filteredSales=sales.filter(filterFn);
  const totalSales=filteredSales.reduce((s,x)=>s+safeNum(x.total),0);
  const totalProfit=filteredSales.reduce((s,x)=>s+safeNum(x.profit),0);
  const wholesaleSales=filteredSales.filter(s=>s.saleType==="পাইকারি").reduce((s,x)=>s+safeNum(x.total),0);
  const retailSales=filteredSales.filter(s=>s.saleType==="খুচরা").reduce((s,x)=>s+safeNum(x.total),0);
  const wholesaleProfit=filteredSales.filter(s=>s.saleType==="পাইকারি").reduce((s,x)=>s+safeNum(x.profit),0);
  const retailProfit=filteredSales.filter(s=>s.saleType==="খুচরা").reduce((s,x)=>s+safeNum(x.profit),0);
  const seedSales=filteredSales.reduce((s,x)=>s+(x.items||[{productId:x.productId,total:x.total,mainCat:x.mainCat}])
    .filter(i=>i.mainCat==="বীজ"||products.find(p=>p.id===i.productId)?.mainCat==="বীজ")
    .reduce((a,b)=>a+safeNum(b.total),0),0);
  const pestSales=filteredSales.reduce((s,x)=>s+(x.items||[{productId:x.productId,total:x.total,mainCat:x.mainCat}])
    .filter(i=>i.mainCat==="কীটনাশক"||products.find(p=>p.id===i.productId)?.mainCat==="কীটনাশক")
    .reduce((a,b)=>a+safeNum(b.total),0),0);
  const totalDue=dues.filter(d=>safeNum(d.dueAmount)>0).reduce((s,d)=>s+safeNum(d.dueAmount),0);

  let todayCollection=0;
  dues.forEach(d=>(d.payments||[]).forEach(p=>{
    if(period==="today"&&p.date===today) todayCollection+=safeNum(p.amount);
    else if(period==="month"&&(p.date||"").startsWith(month)) todayCollection+=safeNum(p.amount);
    else if(period==="all") todayCollection+=safeNum(p.amount);
  }));

  const acc=$("accSummary"); if(!acc) return;
  acc.innerHTML=`
    <div class="acc-card-v2 green"><span class="acc-label"><i class="fa-solid fa-sack-dollar"></i> মোট বিক্রয়</span><div class="acc-val">${money(totalSales)}</div></div>
    <div class="acc-card-v2 green"><span class="acc-label"><i class="fa-solid fa-arrow-trend-up"></i> মোট লাভ</span><div class="acc-val">${money(totalProfit)}</div></div>
    <div class="acc-card-v2 blue"><span class="acc-label"><i class="fa-solid fa-store"></i> পাইকারি বিক্রয়</span><div class="acc-val">${money(wholesaleSales)}</div></div>
    <div class="acc-card-v2 blue"><span class="acc-label"><i class="fa-solid fa-coins"></i> পাইকারি লাভ</span><div class="acc-val">${money(wholesaleProfit)}</div></div>
    <div class="acc-card-v2"><span class="acc-label"><i class="fa-solid fa-basket-shopping"></i> খুচরা বিক্রয়</span><div class="acc-val">${money(retailSales)}</div></div>
    <div class="acc-card-v2"><span class="acc-label"><i class="fa-solid fa-coins" style="color:var(--gold-mid)"></i> খুচরা লাভ</span><div class="acc-val" style="color:var(--gold-deep)">${money(retailProfit)}</div></div>
    <div class="acc-card-v2 green"><span class="acc-label"><i class="fa-solid fa-seedling"></i> বীজ বিক্রয়</span><div class="acc-val">${money(seedSales)}</div></div>
    <div class="acc-card-v2 blue"><span class="acc-label"><i class="fa-solid fa-flask"></i> কীটনাশক বিক্রয়</span><div class="acc-val">${money(pestSales)}</div></div>
    <div class="acc-card-v2 red"><span class="acc-label"><i class="fa-solid fa-file-invoice-dollar"></i> মোট বাকি (বকেয়া)</span><div class="acc-val">${money(totalDue)}</div></div>
    <div class="acc-card-v2 gold"><span class="acc-label"><i class="fa-solid fa-hand-holding-dollar"></i> বাকি আদায়</span><div class="acc-val">${money(todayCollection)}</div></div>
  `;

  // Sales breakdown chart
  const bd=$("salesBreakdown"); if(!bd) return;
  const maxVal=Math.max(seedSales,pestSales,1);
  bd.innerHTML=`
    <div class="chart-bar-label">বিক্রয়ের ধরন অনুযায়ী</div>
    <div class="chart-bar-row">
      <span class="chart-bar-name">🌱 বীজ</span>
      <div class="chart-bar-track"><div class="chart-bar-fill" style="width:${(seedSales/maxVal*100).toFixed(1)}%"></div></div>
      <span class="chart-bar-val">${money(seedSales)}</span>
    </div>
    <div class="chart-bar-row">
      <span class="chart-bar-name">🧪 কীটনাশক</span>
      <div class="chart-bar-track"><div class="chart-bar-fill pest-bar" style="width:${(pestSales/maxVal*100).toFixed(1)}%"></div></div>
      <span class="chart-bar-val">${money(pestSales)}</span>
    </div>
    <div class="chart-bar-label" style="margin-top:14px">বিক্রয়ের ধরন (পাইকারি/খুচরা)</div>
    <div class="chart-bar-row">
      <span class="chart-bar-name">পাইকারি</span>
      <div class="chart-bar-track"><div class="chart-bar-fill" style="width:${(wholesaleSales/Math.max(wholesaleSales,retailSales,1)*100).toFixed(1)}%;background:linear-gradient(90deg,var(--sky-dark),var(--sky-bright))"></div></div>
      <span class="chart-bar-val">${money(wholesaleSales)}</span>
    </div>
    <div class="chart-bar-row">
      <span class="chart-bar-name">খুচরা</span>
      <div class="chart-bar-track"><div class="chart-bar-fill" style="width:${(retailSales/Math.max(wholesaleSales,retailSales,1)*100).toFixed(1)}%"></div></div>
      <span class="chart-bar-val">${money(retailSales)}</span>
    </div>
  `;

  // Today's collections table
  const ctTbody=$("todayCollectionTable"); if(!ctTbody) return;
  const collRows=[];
  dues.forEach(d=>(d.payments||[]).forEach(p=>{
    let ok=false;
    if(period==="today"&&p.date===today) ok=true;
    else if(period==="month"&&(p.date||"").startsWith(month)) ok=true;
    else if(period==="all") ok=true;
    if(ok) collRows.push({name:d.customerName,product:d.productName,amount:p.amount,time:p.createdAt||p.date});
  }));
  ctTbody.innerHTML=collRows.length
    ?collRows.map(r=>`<tr><td>${safeText(r.name)}</td><td>${safeText(r.product||"-")}</td><td style="color:var(--green-dark);font-weight:700">${money(r.amount)}</td><td>${formatTime({createdAt:r.time})}</td></tr>`).join("")
    :`<tr><td colspan="4" style="text-align:center;color:var(--text-3);padding:16px">কোনো আদায় নেই</td></tr>`;
}

/* ===================== Reports ===================== */
function getReportData(filter){
  const today=todayISO(), month=currentMonth();
  let filterFn=()=>true;
  if(filter==="daily") filterFn=s=>s.date===today;
  else if(filter==="monthly") filterFn=s=>(s.date||"").startsWith(month);

  const fs=sales.filter(filterFn);
  const totalSales=fs.reduce((s,x)=>s+safeNum(x.total),0);
  const totalProfit=fs.reduce((s,x)=>s+safeNum(x.profit),0);
  const wholesaleSales=fs.filter(s=>s.saleType==="পাইকারি").reduce((s,x)=>s+safeNum(x.total),0);
  const retailSales=fs.filter(s=>s.saleType==="খুচরা").reduce((s,x)=>s+safeNum(x.total),0);
  const wholesaleProfit=fs.filter(s=>s.saleType==="পাইকারি").reduce((s,x)=>s+safeNum(x.profit),0);
  const paidSales=fs.filter(s=>s.paymentMethod==="সম্পূর্ণ নগদ").reduce((s,x)=>s+safeNum(x.total),0)
    +fs.filter(s=>s.paymentMethod==="মোবাইল ব্যাংকিং").reduce((s,x)=>s+safeNum(x.total),0)
    +fs.filter(s=>s.paymentMethod==="আংশিক").reduce((s,x)=>s+safeNum(x.paidAmount||0),0);
  const dueSales=fs.filter(s=>s.paymentMethod!=="সম্পূর্ণ নগদ").reduce((s,x)=>s+safeNum(x.dueAmount||0),0);
  const totalDue=dues.filter(d=>safeNum(d.dueAmount)>0).reduce((s,d)=>s+safeNum(d.dueAmount),0);
  let dueCollection=0;
  dues.forEach(d=>(d.payments||[]).forEach(p=>{
    if(filter==="daily"&&p.date===today) dueCollection+=safeNum(p.amount);
    else if(filter==="monthly"&&(p.date||"").startsWith(month)) dueCollection+=safeNum(p.amount);
    else if(filter==="all") dueCollection+=safeNum(p.amount);
  }));

  // Product totals
  const productMap={};
  fs.forEach(s=>(s.items||[{productId:s.productId,productName:s.productName,quantity:s.quantity,total:s.total}]).forEach(item=>{
    const prod=products.find(p=>p.id===item.productId)||{name:item.productName,mainCat:"অজানা"};
    const k=item.productId||item.productName;
    if(!productMap[k]) productMap[k]={name:prod.name||item.productName,mainCat:prod.mainCat||"",total:0,qty:0};
    productMap[k].total+=safeNum(item.total);
    productMap[k].qty+=safeNum(item.quantity);
  }));
  const sortedProds=Object.values(productMap).sort((a,b)=>b.total-a.total);
  const topProduct=sortedProds[0]?.name||"-";
  const seedProds=sortedProds.filter(p=>p.mainCat==="বীজ");
  const pestProds=sortedProds.filter(p=>p.mainCat==="কীটনাশক");
  const seedSales=seedProds.reduce((s,p)=>s+p.total,0);
  const pestSales=pestProds.reduce((s,p)=>s+p.total,0);

  return {
    totalSales,totalProfit,wholesaleSales,retailSales,wholesaleProfit,
    paidSales,dueSales,totalDue,dueCollection,
    topProduct,seedProds,pestProds,seedSales,pestSales,
    saleCount:fs.length,
    totalQty:fs.reduce((s,x)=>s+safeNum(x.quantity),0)
  };
}

function renderReportCards(){
  const data=getReportData(reportFilter);
  $("rSales").textContent=money(data.totalSales);
  $("rCollected").textContent=money(data.paidSales);
  $("rWholesale").textContent=money(data.wholesaleSales);
  $("rRetail").textContent=money(data.retailSales);
  $("rProfit").textContent=money(data.totalProfit);
  $("rDueSales").textContent=money(data.dueSales);
  $("rDueCollection").textContent=money(data.dueCollection);
  $("rDueLeft").textContent=money(data.totalDue);
  $("rTopProduct").textContent=data.topProduct;
  $("rSoldQty").textContent=data.totalQty;
  $("rSaleCount").textContent=data.saleCount;
  $("rSeedSales").textContent=money(data.seedSales);
  $("rPestSales").textContent=money(data.pestSales);
  $("rWholesaleProfit").textContent=money(data.wholesaleProfit);

  // Bar charts
  const maxSeed=Math.max(...data.seedProds.map(p=>p.total),1);
  $("topSeedsList").innerHTML=data.seedProds.slice(0,5).map(p=>`
    <div class="chart-bar-row">
      <span class="chart-bar-name" title="${safeText(p.name)}">${safeText(p.name)}</span>
      <div class="chart-bar-track"><div class="chart-bar-fill" style="width:${(p.total/maxSeed*100).toFixed(1)}%"></div></div>
      <span class="chart-bar-val">${money(p.total)}</span>
    </div>`).join("")||`<p style="color:var(--text-3);font-size:.82rem">কোনো তথ্য নেই</p>`;

  const maxPest=Math.max(...data.pestProds.map(p=>p.total),1);
  $("topPestsList").innerHTML=data.pestProds.slice(0,5).map(p=>`
    <div class="chart-bar-row">
      <span class="chart-bar-name" title="${safeText(p.name)}">${safeText(p.name)}</span>
      <div class="chart-bar-track"><div class="chart-bar-fill pest-bar" style="width:${(p.total/maxPest*100).toFixed(1)}%"></div></div>
      <span class="chart-bar-val">${money(p.total)}</span>
    </div>`).join("")||`<p style="color:var(--text-3);font-size:.82rem">কোনো তথ্য নেই</p>`;
}


/* ===================== Date Range Report Export ===================== */
async function exportDateRangeReport(startDate, endDate){
  // Filter sales within date range (inclusive)
  const filteredSales = sales.filter(s => {
    const d = s.date || (s.createdAt || "").slice(0,10);
    return d >= startDate && d <= endDate;
  });

  if(!filteredSales.length){
    showToast("নির্বাচিত তারিখ সীমায় কোনো বিক্রয় পাওয়া যায়নি");
    return;
  }

  const totalSales   = filteredSales.reduce((s,x)=>s+safeNum(x.total),0);
  const totalProfit  = filteredSales.reduce((s,x)=>s+safeNum(x.profit),0);
  const wholesaleSales = filteredSales.filter(s=>s.saleType==="পাইকারি").reduce((s,x)=>s+safeNum(x.total),0);
  const retailSales  = filteredSales.filter(s=>s.saleType==="খুচরা").reduce((s,x)=>s+safeNum(x.total),0);
  const paidSales    = filteredSales.filter(s=>s.paymentMethod==="সম্পূর্ণ নগদ").reduce((s,x)=>s+safeNum(x.total),0)
                     + filteredSales.filter(s=>s.paymentMethod==="আংশিক").reduce((s,x)=>s+safeNum(x.paidAmount||0),0)
                     + filteredSales.filter(s=>s.paymentMethod==="মোবাইল ব্যাংকিং").reduce((s,x)=>s+safeNum(x.total),0);
  const dueSales     = filteredSales.reduce((s,x)=>s+safeNum(x.dueAmount||0),0);
  const totalDiscount= filteredSales.reduce((s,x)=>s+safeNum(x.discount||0),0);

  // Build product summary
  const productMap = {};
  filteredSales.forEach(s=>{
    (s.items||[{productId:s.productId,productName:s.productName,quantity:s.quantity,price:s.price||0,discount:0,total:s.total,profit:s.profit||0}])
      .forEach(item=>{
        const prod = products.find(p=>p.id===item.productId)||{name:item.productName,mainCat:"অন্যান্য",unit:""};
        const k = item.productId||item.productName;
        if(!productMap[k]) productMap[k]={
          sl:0, name:prod.name||item.productName, cat:prod.mainCat||"",
          unit:prod.unit||"", qty:0, price:item.price||0, total:0, profit:0
        };
        productMap[k].qty   += safeNum(item.quantity);
        productMap[k].total += safeNum(item.total);
        productMap[k].profit+= safeNum(item.profit||0);
        productMap[k].price  = item.price||productMap[k].price;
      });
  });
  const sortedProds = Object.values(productMap).sort((a,b)=>b.total-a.total);
  sortedProds.forEach((p,i)=>p.sl=i+1);

  const shopN = safeText(settings.shopName||"সাইদার রহমান কৃষি সেবা");
  const shopA = safeText(settings.shopAddress||"");
  const shopP = safeText(settings.shopPhone||"");
  const genTime = new Date().toLocaleString("bn-BD");
  const dateRange = startDate===endDate ? startDate : `${startDate} থেকে ${endDate}`;

  const tableRows = sortedProds.map(p=>`
    <tr>
      <td style="border:1px solid #c8d9d1;padding:9px 12px;text-align:center;color:#4e7260;font-size:.82rem">${p.sl}</td>
      <td style="border:1px solid #c8d9d1;padding:9px 12px;font-weight:600;color:#0b1e16;font-size:.84rem">${safeText(p.name)}</td>
      <td style="border:1px solid #c8d9d1;padding:9px 12px;text-align:center;font-size:.82rem">
        <span style="background:${p.cat==="বীজ"?"#dcfce7":"#e0f2fe"};color:${p.cat==="বীজ"?"#16a34a":"#0284c7"};padding:2px 8px;border-radius:10px;font-size:.72rem;font-weight:700">${p.cat||"-"}</span>
      </td>
      <td style="border:1px solid #c8d9d1;padding:9px 12px;text-align:center;font-weight:700;font-size:.84rem">${p.qty} ${safeText(p.unit)}</td>
      <td style="border:1px solid #c8d9d1;padding:9px 12px;text-align:right;font-size:.82rem">${money(p.price)}</td>
      <td style="border:1px solid #c8d9d1;padding:9px 12px;text-align:right;font-weight:700;color:#0f3d2e;font-size:.84rem">${money(p.total)}</td>
    </tr>`).join("");

  const div = document.createElement("div");
  div.style.cssText=`position:fixed;left:-9999px;top:0;width:820px;background:#fff;font-family:'Hind Siliguri',sans-serif;padding:0;box-sizing:border-box;`;
  div.innerHTML=`
  <div style="padding:36px 40px 32px;background:#fff">
    <!-- HEADER -->
    <div style="display:flex;align-items:flex-start;justify-content:space-between;margin-bottom:28px;padding-bottom:22px;border-bottom:3px solid #0f3d2e">
      <div style="display:flex;align-items:center;gap:16px">
        <div style="width:58px;height:58px;background:linear-gradient(135deg,#0f3d2e,#1a6b4f);border-radius:14px;display:flex;align-items:center;justify-content:center;box-shadow:0 6px 18px rgba(15,61,46,0.3)">
          <span style="color:white;font-size:1.8rem">🌱</span>
        </div>
        <div>
          <h1 style="margin:0;font-size:1.4rem;font-weight:800;color:#0b1e16;line-height:1.1">${shopN}</h1>
          <p style="margin:4px 0 0;color:#4e7260;font-size:.82rem">বীজ ও কীটনাশক বিক্রয়</p>
          ${shopA?`<p style="margin:2px 0;color:#5a7a6a;font-size:.78rem">📍 ${shopA}</p>`:""}
          ${shopP?`<p style="margin:2px 0;color:#5a7a6a;font-size:.78rem">📞 ${shopP}</p>`:""}
        </div>
      </div>
      <div style="text-align:right">
        <div style="background:linear-gradient(135deg,#0f3d2e,#1a6b4f);color:white;padding:6px 16px;border-radius:20px;font-size:.78rem;font-weight:700;margin-bottom:8px;display:inline-block">ব্যবসায়িক বিক্রয় রিপোর্ট</div>
        <div style="font-size:.82rem;color:#0f3d2e;font-weight:700">📅 ${dateRange}</div>
        <div style="font-size:.73rem;color:#8aaa9a;margin-top:4px">তৈরি: ${genTime}</div>
      </div>
    </div>

    <!-- SUMMARY KPI ROW -->
    <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:26px">
      ${[
        ["মোট বিক্রয়",money(totalSales),"#dcfce7","#0f3d2e","#bbf7d0"],
        ["মোট লাভ",money(totalProfit),"#dcfce7","#16a34a","#bbf7d0"],
        ["নগদ/মোবাইল প্রাপ্ত",money(paidSales),"#ccfbf1","#0d9488","#99f6e4"],
        ["বাকি বিক্রয়",money(dueSales),"#ffe4e6","#e11d48","#fecdd3"],
      ].map(([lbl,val,bg,col,border])=>`
        <div style="background:${bg};border:1.5px solid ${border};border-radius:12px;padding:14px 16px">
          <div style="font-size:.68rem;color:#5a7a6a;font-weight:700;text-transform:uppercase;letter-spacing:.04em;margin-bottom:5px">${lbl}</div>
          <div style="font-size:1.2rem;font-weight:800;color:${col}">${val}</div>
        </div>`).join("")}
    </div>
    <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:28px">
      ${[
        ["পাইকারি বিক্রয়",money(wholesaleSales),"#e0f2fe","#0284c7","#bae6fd"],
        ["খুচরা বিক্রয়",money(retailSales),"#fef3c7","#d97706","#fed7aa"],
        ["মোট ছাড়",money(totalDiscount),"#f3e8ff","#9333ea","#e9d5ff"],
        ["মোট বিক্রয় সংখ্যা",filteredSales.length+" টি","#f0fdf4","#16a34a","#bbf7d0"],
      ].map(([lbl,val,bg,col,border])=>`
        <div style="background:${bg};border:1.5px solid ${border};border-radius:12px;padding:14px 16px">
          <div style="font-size:.68rem;color:#5a7a6a;font-weight:700;text-transform:uppercase;letter-spacing:.04em;margin-bottom:5px">${lbl}</div>
          <div style="font-size:1.2rem;font-weight:800;color:${col}">${val}</div>
        </div>`).join("")}
    </div>

    <!-- PRODUCT TABLE -->
    <div style="margin-bottom:24px">
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:14px">
        <div style="width:4px;height:20px;background:linear-gradient(180deg,#0f3d2e,#22c55e);border-radius:2px"></div>
        <h3 style="margin:0;font-size:.9rem;font-weight:700;color:#0b1e16">পণ্য বিক্রয় বিস্তারিত</h3>
      </div>
      <table style="width:100%;border-collapse:collapse;font-family:'Hind Siliguri',sans-serif">
        <thead>
          <tr style="background:#0f3d2e">
            <th style="border:1px solid #0f3d2e;padding:11px 12px;color:white;font-size:.75rem;text-align:center;font-weight:700;letter-spacing:.04em">ক্র.নং</th>
            <th style="border:1px solid #0f3d2e;padding:11px 12px;color:white;font-size:.75rem;text-align:left;font-weight:700">পণ্যের নাম</th>
            <th style="border:1px solid #0f3d2e;padding:11px 12px;color:white;font-size:.75rem;text-align:center;font-weight:700">ক্যাটাগরি</th>
            <th style="border:1px solid #0f3d2e;padding:11px 12px;color:white;font-size:.75rem;text-align:center;font-weight:700">বিক্রিত পরিমাণ</th>
            <th style="border:1px solid #0f3d2e;padding:11px 12px;color:white;font-size:.75rem;text-align:right;font-weight:700">একক মূল্য</th>
            <th style="border:1px solid #0f3d2e;padding:11px 12px;color:white;font-size:.75rem;text-align:right;font-weight:700">মোট বিক্রয়</th>
          </tr>
        </thead>
        <tbody>
          ${tableRows}
          <tr style="background:#f5f8f6">
            <td colspan="3" style="border:1px solid #c8d9d1;padding:11px 12px;font-weight:700;text-align:center;color:#0f3d2e;font-size:.84rem">সর্বমোট</td>
            <td style="border:1px solid #c8d9d1;padding:11px 12px;text-align:center;font-weight:700;color:#0f3d2e;font-size:.84rem">${filteredSales.reduce((s,x)=>s+safeNum(x.quantity),0)}</td>
            <td style="border:1px solid #c8d9d1;padding:11px 12px"></td>
            <td style="border:1px solid #c8d9d1;padding:11px 12px;text-align:right;font-weight:800;color:#0f3d2e;font-size:.9rem">${money(totalSales)}</td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- PAYMENT SUMMARY -->
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:18px;margin-bottom:24px">
      <div style="background:#f5f8f6;border:1px solid #dde8e2;border-radius:12px;padding:16px">
        <div style="font-size:.78rem;font-weight:700;color:#264032;margin-bottom:10px;display:flex;align-items:center;gap:6px"><span>💳</span> পেমেন্ট বিভাজন</div>
        ${Object.entries(
          filteredSales.reduce((acc,s)=>{
            const m=s.paymentMethod||"সম্পূর্ণ নগদ";
            if(!acc[m]) acc[m]={count:0,total:0};
            acc[m].count++; acc[m].total+=safeNum(s.total);
            return acc;
          },{})
        ).map(([method,data])=>`
          <div style="display:flex;justify-content:space-between;align-items:center;padding:6px 0;border-bottom:1px dashed #dde8e2;font-size:.82rem">
            <span style="color:#264032">${method}</span>
            <span style="font-weight:700;color:#0f3d2e">${money(data.total)} <span style="color:#8aaa9a;font-weight:400">(${data.count}টি)</span></span>
          </div>`).join("")}
      </div>
      <div style="background:#f5f8f6;border:1px solid #dde8e2;border-radius:12px;padding:16px">
        <div style="font-size:.78rem;font-weight:700;color:#264032;margin-bottom:10px;display:flex;align-items:center;gap:6px"><span>📊</span> বিক্রয় সারসংক্ষেপ</div>
        ${[
          ["মোট বিক্রয়", money(totalSales), "#0f3d2e"],
          ["মোট লাভ", money(totalProfit), "#16a34a"],
          ["মোট ছাড়", money(totalDiscount), "#d97706"],
          ["নগদ/মোবাইল প্রাপ্ত", money(paidSales), "#0d9488"],
          ["বাকি (বকেয়া)", money(dueSales), "#e11d48"],
        ].map(([k,v,c])=>`
          <div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px dashed #dde8e2;font-size:.82rem">
            <span style="color:#264032">${k}</span>
            <span style="font-weight:700;color:${c}">${v}</span>
          </div>`).join("")}
      </div>
    </div>

    <!-- FOOTER -->
    <div style="border-top:2px solid #dde8e2;padding-top:16px;display:flex;justify-content:space-between;align-items:center">
      <div style="font-size:.75rem;color:#8aaa9a">
        <span style="font-weight:600;color:#4e7260">${shopN}</span> — বীজ ও কীটনাশক বিক্রয়
        ${shopP?` · ${shopP}`:""}
      </div>
      <div style="font-size:.73rem;color:#8aaa9a">রিপোর্ট সময়: ${genTime}</div>
    </div>
  </div>`;

  document.body.appendChild(div);
  try{
    showToast("রিপোর্ট তৈরি হচ্ছে...");
    const canvas=await html2canvas(div,{scale:2,useCORS:true,backgroundColor:"#fff"});
    const link=document.createElement("a");
    link.download=`report-${startDate}-to-${endDate}.png`;
    link.href=canvas.toDataURL("image/png");
    link.click();
    showToast("রিপোর্ট ডাউনলোড হচ্ছে ✓");
  } catch(err){
    console.error(err);
    showToast("রিপোর্ট তৈরিতে সমস্যা হয়েছে");
  } finally {
    document.body.removeChild(div);
  }
}

/* ===================== PNG Export ===================== */
async function exportReportPNG(type){
  const data=getReportData(type==="daily"?"daily":"monthly");
  const label=type==="daily"?`দৈনিক রিপোর্ট — ${todayISO()}`:`মাসিক রিপোর্ট — ${currentMonth()}`;

  // Build printable div
  const div=document.createElement("div");
  div.style.cssText=`position:fixed;left:-9999px;top:0;width:760px;background:#fff;font-family:'Hind Siliguri',sans-serif;padding:32px;box-sizing:border-box;`;
  div.innerHTML=`
    <div style="display:flex;align-items:center;gap:14px;margin-bottom:22px;border-bottom:3px solid #2d6a2d;padding-bottom:18px">
      <div style="width:52px;height:52px;background:linear-gradient(135deg,#2d6a2d,#4caf50);border-radius:12px;display:flex;align-items:center;justify-content:center">
        <span style="color:white;font-size:1.6rem">🌱</span>
      </div>
      <div>
        <h1 style="margin:0;font-size:1.3rem;color:#1a4d1a">${safeText(settings.shopName||"সাইদার রহমান কৃষি সেবা")}</h1>
        <p style="margin:3px 0 0;color:#666;font-size:.82rem">${safeText(settings.shopAddress||"")} ${settings.shopPhone?'· '+safeText(settings.shopPhone):''}</p>
      </div>
      <div style="margin-left:auto;text-align:right">
        <div style="font-size:.82rem;color:#2d6a2d;font-weight:700">${label}</div>
        <div style="font-size:.75rem;color:#888;margin-top:2px">তৈরি: ${new Date().toLocaleString("bn-BD")}</div>
      </div>
    </div>
    <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:22px">
      ${[
        ["মোট বিক্রয়",money(data.totalSales),"#e8f5e9","#1a4d1a"],
        ["মোট লাভ",money(data.totalProfit),"#e8f5e9","#2d6a2d"],
        ["পাইকারি বিক্রয়",money(data.wholesaleSales),"#e3f2fd","#1565c0"],
        ["খুচরা বিক্রয়",money(data.retailSales),"#f1f8e9","#33691e"],
        ["নগদ প্রাপ্ত",money(data.paidSales),"#e8f5e9","#388e3c"],
        ["বাকি বিক্রয়",money(data.dueSales),"#fff8f0","#e65100"],
        ["বাকি আদায়",money(data.dueCollection),"#e8f5e9","#2e7d32"],
        ["মোট বকেয়া",money(data.totalDue),"#ffebee","#c62828"],
      ].map(([label,val,bg,col])=>`
        <div style="background:${bg};border-radius:10px;padding:14px">
          <div style="font-size:.72rem;color:#555;margin-bottom:4px">${label}</div>
          <div style="font-size:1.1rem;font-weight:800;color:${col}">${val}</div>
        </div>`).join("")}
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:18px">
      <div>
        <div style="font-size:.85rem;font-weight:700;color:#1a4d1a;margin-bottom:10px">🌱 সর্বাধিক বিক্রিত বীজ</div>
        ${data.seedProds.slice(0,5).map(p=>`
          <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px">
            <span style="width:120px;font-size:.78rem;color:#333;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${safeText(p.name)}</span>
            <div style="flex:1;height:12px;background:#e8f5e9;border-radius:6px;overflow:hidden">
              <div style="height:100%;background:linear-gradient(90deg,#2d6a2d,#4caf50);width:${(p.total/Math.max(...data.seedProds.map(x=>x.total),1)*100).toFixed(0)}%"></div>
            </div>
            <span style="font-size:.78rem;font-weight:700;color:#1a4d1a;min-width:55px;text-align:right">${money(p.total)}</span>
          </div>`).join("")||"<p style='color:#999;font-size:.8rem'>কোনো তথ্য নেই</p>"}
      </div>
      <div>
        <div style="font-size:.85rem;font-weight:700;color:#1565c0;margin-bottom:10px">🧪 সর্বাধিক বিক্রিত কীটনাশক</div>
        ${data.pestProds.slice(0,5).map(p=>`
          <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px">
            <span style="width:120px;font-size:.78rem;color:#333;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${safeText(p.name)}</span>
            <div style="flex:1;height:12px;background:#e3f2fd;border-radius:6px;overflow:hidden">
              <div style="height:100%;background:linear-gradient(90deg,#1565c0,#42a5f5);width:${(p.total/Math.max(...data.pestProds.map(x=>x.total),1)*100).toFixed(0)}%"></div>
            </div>
            <span style="font-size:.78rem;font-weight:700;color:#1565c0;min-width:55px;text-align:right">${money(p.total)}</span>
          </div>`).join("")||"<p style='color:#999;font-size:.8rem'>কোনো তথ্য নেই</p>"}
      </div>
    </div>
    <div style="margin-top:20px;border-top:1px solid #ddd;padding-top:14px;display:grid;grid-template-columns:repeat(3,1fr);gap:10px">
      <div style="font-size:.78rem;color:#555">সেরা পণ্য: <b style="color:#1a4d1a">${safeText(data.topProduct)}</b></div>
      <div style="font-size:.78rem;color:#555">মোট বিক্রয় সংখ্যা: <b>${data.saleCount}</b></div>
      <div style="font-size:.78rem;color:#555">মোট পরিমাণ: <b>${data.totalQty}</b></div>
    </div>
  `;
  document.body.appendChild(div);

  try{
    showToast("PNG তৈরি হচ্ছে...");
    const canvas=await html2canvas(div,{scale:2,useCORS:true,backgroundColor:"#fff"});
    const link=document.createElement("a");
    link.download=`${type}-report-${type==="daily"?todayISO():currentMonth()}.png`;
    link.href=canvas.toDataURL("image/png");
    link.click();
    showToast("PNG ডাউনলোড হচ্ছে ✓");
  } catch(err){
    console.error(err);
    showToast("PNG তৈরিতে সমস্যা হয়েছে");
  } finally {
    document.body.removeChild(div);
  }
}

/* ===================== Invoice Print ===================== */
function printSaleInvoice(id){
  const s=sales.find(x=>x.id===id); if(!s) return;
  lastInvoice=s; printInvoice();
}
function printInvoice(){
  if(!lastInvoice&&sales.length) lastInvoice=sales[0];
  if(!lastInvoice) return showToast("কোনো ইনভয়েস পাওয়া যায়নি");
  const s=lastInvoice;
  const itemRows=(s.items?.length?s.items:[{productName:s.productName,quantity:s.quantity,price:s.price,discount:0,total:s.total}])
    .map(item=>`<tr>
      <td style="border:1px solid #ddd;padding:8px">${safeText(item.productName)}</td>
      <td style="border:1px solid #ddd;padding:8px;text-align:center">${item.quantity}</td>
      <td style="border:1px solid #ddd;padding:8px;text-align:right">${money(item.price)}</td>
      <td style="border:1px solid #ddd;padding:8px;text-align:right"><b>${money(item.total)}</b></td>
    </tr>`).join("");
  const html=`<div style="max-width:420px;margin:0 auto;font-family:'Hind Siliguri',sans-serif">
    <div style="text-align:center;margin-bottom:20px;border-bottom:3px solid #2d6a2d;padding-bottom:14px">
      <div style="width:48px;height:48px;background:#2d6a2d;border-radius:50%;margin:0 auto 10px;display:flex;align-items:center;justify-content:center">
        <span style="color:white;font-size:1.4rem">🌱</span>
      </div>
      <h1 style="margin:0;color:#2d6a2d;font-size:1.3rem">${safeText(settings.shopName)}</h1>
      <p style="margin:2px 0 0;color:#555;font-size:.78rem">বীজ ও কীটনাশক বিক্রয়</p>
      ${settings.shopAddress?`<p style="margin:3px 0;color:#666;font-size:.8rem">${safeText(settings.shopAddress)}</p>`:""}
      ${settings.shopPhone?`<p style="margin:2px 0;color:#666;font-size:.8rem">📞 ${safeText(settings.shopPhone)}</p>`:""}
    </div>
    <p style="font-size:.85rem;margin:3px 0"><b>ইনভয়েস #:</b> ${s.id}</p>
    <p style="font-size:.85rem;margin:3px 0"><b>তারিখ:</b> ${s.date}</p>
    <p style="font-size:.85rem;margin:3px 0"><b>ক্রেতা:</b> ${safeText(s.customerName||"সাধারণ ক্রেতা")}</p>
    ${s.customerPhone?`<p style="font-size:.85rem;margin:3px 0"><b>মোবাইল:</b> ${safeText(s.customerPhone)}</p>`:""}
    ${s.village?`<p style="font-size:.85rem;margin:3px 0"><b>গ্রাম:</b> ${safeText(s.village)}</p>`:""}
    <p style="font-size:.85rem;margin:3px 0"><b>বিক্রয় ধরন:</b> ${s.saleType||"খুচরা"}</p>
    <table style="width:100%;border-collapse:collapse;margin-top:14px;font-size:.85rem">
      <thead><tr style="background:#2d6a2d;color:#fff">
        <th style="border:1px solid #2d6a2d;padding:8px;text-align:left">পণ্য</th>
        <th style="border:1px solid #2d6a2d;padding:8px;text-align:center">পরিমাণ</th>
        <th style="border:1px solid #2d6a2d;padding:8px;text-align:right">মূল্য</th>
        <th style="border:1px solid #2d6a2d;padding:8px;text-align:right">মোট</th>
      </tr></thead>
      <tbody>${itemRows}</tbody>
    </table>
    <div style="text-align:right;margin-top:14px;border-top:2px solid #2d6a2d;padding-top:10px">
      <h2 style="margin:0;color:#2d6a2d">সর্বমোট: ${money(s.total)}</h2>
    </div>
    <p style="font-size:.85rem;margin:5px 0"><b>পেমেন্ট:</b> ${safeText(s.paymentMethod)}</p>
    ${safeNum(s.dueAmount)>0?`<p style="font-size:.85rem;margin:5px 0;color:#c62828"><b>বাকি:</b> ${money(s.dueAmount)}</p>`:""}
    ${s.note?`<p style="font-size:.85rem;margin:5px 0"><b>নোট:</b> ${safeText(s.note)}</p>`:""}
    <p style="text-align:center;margin-top:24px;color:#666;border-top:1px dashed #ddd;padding-top:12px;font-size:.82rem">
      ${safeText(settings.invoiceFooter||"ধন্যবাদ, আবার আসবেন")}
    </p>
  </div>`;
  $("invoicePrint").innerHTML=html;
  window.print();
}

/* ===================== Settings ===================== */
function fillSettingsForm(){
  if(!$("shopName")) return;
  $("shopName").value=settings.shopName||"";
  $("shopAddress").value=settings.shopAddress||"";
  $("shopPhone").value=settings.shopPhone||"";
  $("invoiceFooter").value=settings.invoiceFooter||"";
  $("adminUser").value=settings.adminUser||"admin";
  $("adminPass").value=settings.adminPass||"1234";
}
async function handleSettingsSave(e){
  e.preventDefault();
  settings={
    shopName:$("shopName").value.trim()||DEFAULT_SETTINGS.shopName,
    shopAddress:$("shopAddress").value.trim(),
    shopPhone:$("shopPhone").value.trim(),
    invoiceFooter:$("invoiceFooter").value.trim()||DEFAULT_SETTINGS.invoiceFooter,
    adminUser:$("adminUser").value.trim()||"admin",
    adminPass:$("adminPass").value.trim()||"1234",
    updatedAt:new Date().toISOString()
  };
  await saveSettings();
  showToast("সেটিংস সংরক্ষিত হয়েছে ✓");
}

/* ===================== Render All ===================== */
function renderAll(){
  renderProducts();
  renderSales();
  renderDues();
  renderDashboard();
  renderReportCards();
  buildNotifications();
}

/* ===================== Auto Product Input ===================== */
function switchProductTab(tab){
  $("tabManual").classList.toggle("active-tab", tab==="manual");
  $("tabAuto").classList.toggle("active-tab", tab==="auto");
  $("paneManual").classList.toggle("active-pane", tab==="manual");
  $("paneAuto").classList.toggle("active-pane", tab==="auto");
}
window.switchProductTab=switchProductTab;

function parseProductText(text){
  const lines=text.split(/\n/).map(l=>l.trim()).filter(Boolean);
  const map={};
  lines.forEach(line=>{
    const idx=line.indexOf(":");
    if(idx<0) return;
    const key=line.slice(0,idx).trim();
    const val=line.slice(idx+1).trim();
    map[key]=val;
  });

  const get=(...keys)=>{
    for(const k of keys){
      for(const mk of Object.keys(map)){
        if(mk.replace(/\s+/g,"").toLowerCase().includes(k.replace(/\s+/g,"").toLowerCase()))
          return map[mk];
      }
    }
    return "";
  };

  const name=get("পণ্যেরনাম","নাম");
  if(!name) return null;

  const mainCatRaw=get("প্রধানক্যাটাগরি","ক্যাটাগরি","maincat");
  const mainCat=mainCatRaw.includes("বীজ")?"বীজ":mainCatRaw.includes("কীটনাশক")?"কীটনাশক":"";

  // Date parsing: DD/MM/YYYY → YYYY-MM-DD
  const parseDate=str=>{
    if(!str) return "";
    const m=str.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
    if(m) return `${m[3]}-${m[2].padStart(2,"0")}-${m[1].padStart(2,"0")}`;
    return str;
  };

  return {
    name,
    brand:get("ব্র্যান্ড","কোম্পানি","brand"),
    mainCat,
    subCat:get("সাবক্যাটাগরি","subcategory"),
    variety:get("ভ্যারাইটি","variety"),
    packSize:get("প্যাকসাইজ","pack","সাইজ"),
    purchasePrice:safeNum(get("ক্রয়মূল্য","purchaseprice","ক্রয়")),
    sellingPrice:safeNum(get("খুচরাবিক্রয়মূল্য","retailprice","খুচরা")),
    wholesalePrice:safeNum(get("পাইকারিবিক্রয়মূল্য","wholesaleprice","পাইকারি")),
    stock:safeNum(get("বর্তমানস্টক","stock","স্টক")),
    unit:get("ইউনিট","unit")||"প্যাকেট",
    lowStockLimit:safeNum(get("কমস্টকসীমা","lowstock","সীমা"))||5,
    batchNo:get("ব্যাচনম্বর","batchno","batch"),
    mfgDate:parseDate(get("উৎপাদনতারিখ","mfgdate","উৎপাদন")),
    expDate:parseDate(get("মেয়াদউত্তীর্ণ","expdate","মেয়াদ")),
  };
}

let autoParsedProduct=null;

document.addEventListener("DOMContentLoaded",()=>{
  const parseBtn=$("autoParseBtn"), fillBtn=$("autoFillBtn"), area=$("autoPasteArea");
  const resultEl=$("autoParseResult"), errEl=$("autoParseError");

  if(parseBtn) parseBtn.addEventListener("click",()=>{
    const text=area?.value||"";
    if(!text.trim()){ showToast("কিছু পেস্ট করুন"); return; }
    autoParsedProduct=parseProductText(text);
    if(!autoParsedProduct){
      errEl.textContent="পণ্যের নাম পাওয়া যায়নি। সঠিক ফরম্যাটে তথ্য দিন।";
      errEl.classList.add("show"); resultEl.classList.remove("show");
      if(fillBtn) fillBtn.style.display="none";
      return;
    }
    errEl.classList.remove("show");
    const p=autoParsedProduct;
    resultEl.innerHTML=`
      <div style="font-size:.82rem;font-weight:700;margin-bottom:8px;color:var(--green-dark)">✓ তথ্য সফলভাবে পড়া হয়েছে</div>
      ${[
        ["পণ্যের নাম",p.name],["ব্র্যান্ড",p.brand||"-"],["ক্যাটাগরি",p.mainCat||"-"],
        ["ভ্যারাইটি",p.variety||"-"],["প্যাক সাইজ",p.packSize||"-"],
        ["ক্রয়মূল্য",p.purchasePrice?money(p.purchasePrice):"-"],
        ["খুচরা মূল্য",p.sellingPrice?money(p.sellingPrice):"-"],
        ["পাইকারি মূল্য",p.wholesalePrice?money(p.wholesalePrice):"-"],
        ["স্টক",p.stock||"-"],["ইউনিট",p.unit],
        ["মেয়াদ",p.expDate||"-"]
      ].map(([k,v])=>`<div class="parse-row"><span class="parse-key">${k}</span><span class="parse-val">${safeText(String(v))}</span></div>`).join("")}
    `;
    resultEl.classList.add("show");
    if(fillBtn) fillBtn.style.display="";
  });

  if(fillBtn) fillBtn.addEventListener("click",async()=>{
    if(!autoParsedProduct){ showToast("আগে বিশ্লেষণ করুন"); return; }
    const p=autoParsedProduct;
    // Switch to manual tab and fill
    switchProductTab("manual");
    $("pName").value=p.name;
    $("pBrand").value=p.brand||"";
    $("pMainCat").value=p.mainCat||"";
    onMainCatChange();
    setTimeout(()=>{
      if(p.subCat && $("pSubCat")) $("pSubCat").value=p.subCat;
    },50);
    $("pVariety").value=p.variety||"";
    $("pPackSize").value=p.packSize||"";
    $("pPurchase").value=p.purchasePrice||"";
    $("pSelling").value=p.sellingPrice||"";
    $("pWholesale").value=p.wholesalePrice||"";
    $("pStock").value=p.stock||"";
    $("pUnit").value=p.unit||"প্যাকেট";
    $("pLimit").value=p.lowStockLimit||5;
    $("pBatch").value=p.batchNo||"";
    $("pMfgDate").value=p.mfgDate||"";
    $("pExpDate").value=p.expDate||"";
    // Submit the product form automatically
    $("productForm").dispatchEvent(new Event("submit",{cancelable:true,bubbles:true}));
    // Clear auto pane
    if(area) area.value="";
    resultEl.classList.remove("show");
    fillBtn.style.display="none";
    autoParsedProduct=null;
  });
});

/* ===================== Expose globals ===================== */
window.setSaleType=setSaleType;
window.selectProduct=selectProduct;
window.editProduct=editProduct;
window.deleteProduct=deleteProduct;
window.collectDue=collectDue;
window.deleteDue=deleteDue;
window.deleteSale=deleteSale;
window.printSaleInvoice=printSaleInvoice;
window.onMainCatChange=onMainCatChange;
window.calcPartialDue=calcPartialDue;
window.renderAccounts=renderAccounts;