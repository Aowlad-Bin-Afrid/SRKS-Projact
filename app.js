/* =========================================================
   সাইদার রহমান কৃষি সেবা — বীজ ও কীটনাশক ব্যবস্থাপনা
   Agricultural Management System — Seeds & Pesticides
   [FIXED VERSION — সকল হিসাব-সংক্রান্ত বাগ সমাধান করা হয়েছে]
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
const WEIGHT_SUBCATS = ["ভুট্টা","গম","ধান","ডাল","সরিষা","চাল","আটা","লবণ","সার","অন্যান্য খোলা পণ্য"];

const DB_PATHS = { products:"products", sales:"sales", dues:"dues", settings:"settings", withdrawals:"withdrawals" };

let db = null, firebaseReady = false;
try {
  if (window.firebase) {
    firebase.initializeApp(firebaseConfig);
    db = firebase.database();
    firebaseReady = true;
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
let withdrawals = getLocal("agri_withdrawals", []);
let lastInvoice = null;
let notifications = [];
let reportFilter = "all";
let showAllHistory = false;
let notifRead    = getLocal(KEYS.notifRead, []);
let notifDeleted = getLocal(KEYS.notifDeleted, []);
let saleCart = [];
let currentSaleType = "খুচরা";
let catFilter = "all";
let dueFilterSearch = "";

/* ===================== Helpers ===================== */
function $(id){ return document.getElementById(id); }
function getLocal(k,fb){ try{ return JSON.parse(localStorage.getItem(k))||fb; }catch(e){ return fb; } }
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
  db.ref("withdrawals").on("value",snap=>{
    const v=snap.val();
    if(v){
      withdrawals=Array.isArray(v)?v.filter(Boolean):Object.values(v);
      setLocal("agri_withdrawals",withdrawals);
      renderWithdrawBalance();
    } else {
      withdrawals=[];
      setLocal("agri_withdrawals",[]);
      renderWithdrawBalance();
    }
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
  initAutoProductInput();
});

function updateSeasonLabel(){
  const m=new Date().getMonth()+1;
  let s="রবি মৌসুম";
  if(m>=3&&m<=6) s="খরিফ-১ মৌসুম";
  else if(m>=7&&m<=10) s="খরিফ-২ মৌসুম";
  const el=$("currentSeason"); if(el) el.textContent=s;
}

/* ===================== Auth ===================== */
/*
  সুরক্ষা নোট: এই লগইন সিস্টেম settings থেকে পাসওয়ার্ড যাচাই করে।
  পূর্ণ নিরাপত্তার জন্য Firebase Authentication ব্যবহার করুন।
  Settings থেকে পাসওয়ার্ড পরিবর্তন করে নিন (ডিফল্ট "1234" রাখবেন না)।
*/
function checkLogin(){
  const logged=localStorage.getItem(KEYS.loggedIn)==="true";
  $("loginPage").style.display=logged?"none":"flex";
  if(logged) $("app").classList.add("show");
  else $("app").classList.remove("show");
}

/* ব্রুট ফোর্স সুরক্ষা */
let loginAttempts=0;
let loginLockUntil=0;

if($("loginForm")) $("loginForm").addEventListener("submit",e=>{
  e.preventDefault();
  const now=Date.now();
  if(now<loginLockUntil){
    const secs=Math.ceil((loginLockUntil-now)/1000);
    showToast(`অনেকবার ভুল হয়েছে। ${secs} সেকেন্ড অপেক্ষা করুন।`);
    return;
  }
  const u=$("username").value.trim(), p=$("password").value.trim();
  if(u===settings.adminUser && p===settings.adminPass){
    loginAttempts=0;
    localStorage.setItem(KEYS.loggedIn,"true");
    checkLogin(); showToast("লগইন সফল ✓");
  } else {
    loginAttempts++;
    if(loginAttempts>=5){
      loginLockUntil=Date.now()+30000;
      loginAttempts=0;
      showToast("৫ বার ভুল হয়েছে। ৩০ সেকেন্ড অপেক্ষা করুন।");
    } else {
      showToast(`ইউজারনেম বা পাসওয়ার্ড ভুল (${loginAttempts}/5)`);
    }
    $("password").value=""; $("password").focus();
  }
});
if($("showPass")) $("showPass").addEventListener("click",()=>{
  const p=$("password"), icon=$("showPass").querySelector("i");
  const h=p.type==="password";
  p.type=h?"text":"password";
  if(icon) icon.className=h?"fa-regular fa-eye-slash":"fa-regular fa-eye";
});
if($("logoutBtn")) $("logoutBtn").addEventListener("click",()=>{
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
  if(id==="settings") { renderWithdrawBalance(); if($("withdrawDate")&&!$("withdrawDate").value) $("withdrawDate").value=todayISO(); }
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
  if($("closePartialReport")) $("closePartialReport").addEventListener("click", closePartialSoldReport);
  const partialOverlay=$("partialSoldPanel");
  if(partialOverlay) partialOverlay.addEventListener("click",e=>{ if(e.target===partialOverlay) closePartialSoldReport(); });

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
  $("seedFields").style.display="none";
  $("pestFields").style.display="none";
  $("weightFields").style.display="none";
  if(cat==="বীজ"){
    sub.innerHTML=`<option value="">সাব-ক্যাটাগরি বেছে নিন</option>`+
      SEED_SUBCATS.map(s=>`<option>${safeText(s)}</option>`).join("");
    $("seedFields").style.display="";
  } else if(cat==="কীটনাশক"){
    sub.innerHTML=`<option value="">সাব-ক্যাটাগরি বেছে নিন</option>`+
      PEST_SUBCATS.map(s=>`<option>${safeText(s)}</option>`).join("");
    $("pestFields").style.display="";
  } else if(cat==="ওজনভিত্তিক"){
    sub.innerHTML=`<option value="">সাব-ক্যাটাগরি বেছে নিন</option>`+
      WEIGHT_SUBCATS.map(s=>`<option>${safeText(s)}</option>`).join("");
    $("weightFields").style.display="";
    // Auto-set unit from weight unit selector
    const wu=$("pWeightUnit");
    if(wu && $("pUnit")) $("pUnit").value=wu.value;
    if(wu) wu.addEventListener("change",()=>{ if($("pUnit")) $("pUnit").value=wu.value; },{once:false});
  } else {
    sub.innerHTML=`<option value="">প্রথমে প্রধান ক্যাটাগরি বেছে নিন</option>`;
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
    $("productDropdownSearch").addEventListener("input",e=>{
      const cb=$("clearProdSearch");
      if(cb) cb.style.display=e.target.value?"":"none";
      renderProductCards();
    });
  [$("saleQty"),$("salePrice"),$("saleDiscount")].forEach(el=>{
    if(el) el.addEventListener("input",updateCartTotal);
  });
  $("printInvoiceBtn").addEventListener("click",printInvoice);

  if($("withdrawBtn")) $("withdrawBtn").addEventListener("click",handleWithdraw);
  if($("withdrawDate")&&!$("withdrawDate").value) $("withdrawDate").value=todayISO();

  const openBtn=$("openProductFormBtn");
  const closeBtn=$("closeProductFormBtn");
  const formCard=$("productFormCard");
  if(openBtn && formCard){
    openBtn.addEventListener("click",()=>{
      formCard.style.display="";
      formCard.scrollIntoView({behavior:"smooth",block:"start"});
      openBtn.innerHTML=`<i class="fa-solid fa-minus"></i> ফর্ম বন্ধ করুন`;
    });
  }
  if(closeBtn && formCard){
    closeBtn.addEventListener("click",()=>{
      formCard.style.display="none";
      resetProductForm();
      if(openBtn) openBtn.innerHTML=`<i class="fa-solid fa-plus"></i> নতুন পণ্য যোগ করুন`;
    });
  }

  if($("dailyPngBtn")) $("dailyPngBtn").addEventListener("click",()=>exportReportPNG("daily"));
  if($("monthlyPngBtn")) $("monthlyPngBtn").addEventListener("click",()=>exportReportPNG("monthly"));
  if($("downloadDateReportBtn")){
    $("downloadDateReportBtn").addEventListener("click",()=>{
      const start=$("reportStartDate")?.value;
      const end=$("reportEndDate")?.value;
      if(!start||!end){ showToast("শুরুর ও শেষের তারিখ নির্বাচন করুন"); return; }
      if(start>end){ showToast("শুরুর তারিখ শেষের তারিখের আগে হতে হবে"); return; }
      exportDateRangeReport(start,end);
    });
    const t=todayISO();
    if($("reportStartDate")&&!$("reportStartDate").value) $("reportStartDate").value=t;
    if($("reportEndDate")&&!$("reportEndDate").value) $("reportEndDate").value=t;
  }
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
    unit:mainCat==="ওজনভিত্তিক"?($("pWeightUnit")?.value||$("pUnit").value.trim()||"কেজি"):($("pUnit").value.trim()||"প্যাকেট"),
    lowStockLimit:safeNum($("pLimit").value)||5,
    batchNo:$("pBatch").value.trim(),
    mfgDate:$("pMfgDate").value,
    expDate:$("pExpDate").value,
    isWeightProduct: mainCat==="ওজনভিত্তিক",
    germRate: mainCat==="বীজ"?safeNum($("pGermRate").value):"",
    season:   mainCat==="বীজ"?$("pSeason").value:"",
    cropType: mainCat==="বীজ"?$("pCropType").value.trim():"",
    activeIng:mainCat==="কীটনাশক"?$("pActiveIng").value.trim():"",
    dosage:   mainCat==="কীটনাশক"?$("pDosage").value.trim():"",
    target:   mainCat==="কীটনাশক"?$("pTarget").value.trim():"",
    warning:  mainCat==="কীটনাশক"?$("pWarning").value.trim():"",
    bagWeight:mainCat==="ওজনভিত্তিক"?safeNum($("pBagWeight")?.value):"",
    weightSource:mainCat==="ওজনভিত্তিক"?($("pWeightSource")?.value.trim()||""):"",
    createdAt:existing?.createdAt||new Date().toISOString(),
    updatedAt:new Date().toISOString()
  };

  if(existing) products=products.map(p=>p.id===id?product:p);
  else products=[product,...products];
  await saveNode("products",products);
  resetProductForm();
  const fc=$("productFormCard"), ob=$("openProductFormBtn");
  if(fc) fc.style.display="none";
  if(ob) ob.innerHTML=`<i class="fa-solid fa-plus"></i> নতুন পণ্য যোগ করুন`;
  showToast(existing?"পণ্য আপডেট হয়েছে ✓":"পণ্য যোগ হয়েছে ✓");
  renderAll();
}

function resetProductForm(){
  $("productForm").reset();
  $("productId").value="";
  $("seedFields").style.display="none";
  $("pestFields").style.display="none";
  if($("weightFields")) $("weightFields").style.display="none";
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
  } else if(p.mainCat==="ওজনভিত্তিক"){
    if($("pWeightUnit")) $("pWeightUnit").value=p.unit||"কেজি";
    if($("pBagWeight")) $("pBagWeight").value=p.bagWeight||"";
    if($("pWeightSource")) $("pWeightSource").value=p.weightSource||"";
  }
  switchSection("products");
  const fc=$("productFormCard"), ob=$("openProductFormBtn");
  if(fc){ fc.style.display=""; setTimeout(()=>fc.scrollIntoView({behavior:"smooth",block:"start"}),100); }
  if(ob) ob.innerHTML=`<i class="fa-solid fa-minus"></i> ফর্ম বন্ধ করুন`;
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
  const totalP=products.length;
  const seedP=products.filter(p=>p.mainCat==="বীজ").length;
  const pestP=products.filter(p=>p.mainCat==="কীটনাশক").length;
  const weightP=products.filter(p=>p.mainCat==="ওজনভিত্তিক"||p.isWeightProduct).length;
  const lowP=products.filter(p=>safeNum(p.stock)<=safeNum(p.lowStockLimit||5)).length;
  const stockVal=products.reduce((s,p)=>s+safeNum(p.stock)*safeNum(p.purchasePrice),0);
  if($("stockSummaryTotal")) $("stockSummaryTotal").textContent=totalP;
  if($("stockSummarySeed"))  $("stockSummarySeed").textContent=seedP;
  if($("stockSummaryPest"))  $("stockSummaryPest").textContent=pestP;
  if($("stockSummaryWeight")) $("stockSummaryWeight").textContent=weightP;
  if($("stockSummaryLow"))   $("stockSummaryLow").textContent=lowP;
  if($("stockSummaryValue")) $("stockSummaryValue").textContent=money(stockVal);

  const tbody=$("productTable"); if(!tbody) return;
  const q=($("productSearch")?.value||"").toLowerCase();
  const fc=$("productFilterCat")?.value||"";
  const filtered=products.filter(p=>{
    const match=`${p.name} ${p.brand||""} ${p.variety||""} ${p.subCat||""}`.toLowerCase().includes(q);
    const catMatch=!fc||p.mainCat===fc;
    return match&&catMatch;
  });
  tbody.innerHTML=filtered.map(p=>{
    const isSeed=p.mainCat==="বীজ";
    const isWeight=p.mainCat==="ওজনভিত্তিক"||p.isWeightProduct;
    const expDays=p.expDate?daysUntil(p.expDate):null;
    const expStr=!p.expDate?"-":expDays!==null&&expDays<=30
      ?`<span class="expiry-warning">⚠️ ${p.expDate} (${expDays}d)</span>`
      :`<span class="expiry-ok">${p.expDate}</span>`;
    const stockBadge=safeNum(p.stock)<=safeNum(p.lowStockLimit)
      ?`<span class="badge red">${p.stock} ${p.unit||""}</span>`
      :`<span class="badge ${isWeight?"purple":"green"}">${p.stock} ${p.unit||""}</span>`;
    const catBadge=isWeight
      ?`<span class="product-type-badge weight">⚖️ ওজনভিত্তিক</span>`
      :isSeed?`<span class="product-type-badge seed">🌱 বীজ</span>`
      :`<span class="product-type-badge pest">🧪 কীটনাশক</span>`;
    return `<tr>
      <td><b>${safeText(p.name)}</b>${p.variety?`<span class="variety-badge">${safeText(p.variety)}</span>`:""}${p.packSize?`<span class="variety-badge">${safeText(p.packSize)}</span>`:""}
      ${isWeight?`<span class="weight-prod-tag"><i class="fa-solid fa-weight-hanging"></i></span>`:""}
      </td>
      <td>${catBadge}${p.subCat?`<span class="variety-badge">${safeText(p.subCat)}</span>`:""}</td>
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
  renderWeightProductsSection();
}

/* ===================== Weight Products Section ===================== */
function renderWeightProductsSection(){
  const grid=$("weightProductGrid");
  const badge=$("weightSectionBadge");
  const empty=$("weightEmptyState");
  if(!grid) return;

  const weightProds=products.filter(p=>p.mainCat==="ওজনভিত্তিক"||p.isWeightProduct);
  if(badge) badge.textContent=`${weightProds.length}টি পণ্য`;

  if(!weightProds.length){
    if(empty) empty.style.display="";
    grid.innerHTML="";
    grid.appendChild(empty||document.createElement("div"));
    return;
  }
  if(empty) empty.style.display="none";

  // Get sold qty for weight products
  const soldMap={};
  sales.forEach(s=>{
    (s.items||[{productId:s.productId,quantity:s.quantity,isWeightSale:s.isWeightSale}]).forEach(item=>{
      if(item.isWeightSale||item.productId){
        const pid=item.productId;
        if(!soldMap[pid]) soldMap[pid]=0;
        soldMap[pid]+=safeNum(item.quantity);
      }
    });
  });

  grid.innerHTML=weightProds.map(p=>{
    const totalSold=soldMap[p.id]||0;
    const currentStock=safeNum(p.stock);
    const estimatedInitial=currentStock+totalSold;
    const prog=estimatedInitial>0?Math.min(100,(totalSold/estimatedInitial*100)).toFixed(0):0;
    const isLow=currentStock<=safeNum(p.lowStockLimit||5);
    const stockClass=isLow?"weight-stock-low":"weight-stock-ok";

    return `<div class="weight-prod-card ${isLow?"weight-card-low":""}">
      <div class="wpc-header">
        <div class="wpc-name-wrap">
          <div class="wpc-icon"><i class="fa-solid fa-weight-hanging"></i></div>
          <div>
            <div class="wpc-name">${safeText(p.name)}</div>
            ${p.subCat?`<div class="wpc-sub">${safeText(p.subCat)}</div>`:""}
          </div>
        </div>
        <div class="wpc-actions">
          <button class="btn btn-sm btn-outline" onclick="editProduct('${p.id}')" title="সম্পাদনা"><i class="fa-solid fa-pen"></i></button>
          <button class="btn btn-sm btn-danger" onclick="deleteProduct('${p.id}')" title="মুছুন"><i class="fa-solid fa-trash"></i></button>
        </div>
      </div>

      <div class="wpc-stats-row">
        <div class="wpc-stat">
          <span class="wpc-stat-label">প্রাথমিক স্টক</span>
          <strong class="wpc-stat-val">${estimatedInitial} ${p.unit||"কেজি"}</strong>
        </div>
        <div class="wpc-stat">
          <span class="wpc-stat-label">মোট বিক্রিত</span>
          <strong class="wpc-stat-val sold">${totalSold} ${p.unit||"কেজি"}</strong>
        </div>
        <div class="wpc-stat">
          <span class="wpc-stat-label">অবশিষ্ট স্টক</span>
          <strong class="wpc-stat-val ${stockClass}">${currentStock} ${p.unit||"কেজি"}</strong>
        </div>
        <div class="wpc-stat">
          <span class="wpc-stat-label">বিক্রয়মূল্য/একক</span>
          <strong class="wpc-stat-val">${money(p.sellingPrice)}</strong>
        </div>
      </div>

      <div class="wpc-progress-wrap">
        <div class="wpc-prog-labels">
          <span>বিক্রিত ${prog}%</span>
          <span>অবশিষ্ট ${100-Number(prog)}%</span>
        </div>
        <div class="wpc-progress-track">
          <div class="wpc-progress-fill" style="width:${prog}%"></div>
          <div class="wpc-progress-remain" style="width:${100-Number(prog)}%"></div>
        </div>
      </div>

      ${isLow?`<div class="wpc-low-alert"><i class="fa-solid fa-triangle-exclamation"></i> স্টক কম — মাত্র ${currentStock} ${p.unit||"কেজি"} বাকি</div>`:""}

      <div class="wpc-footer">
        <span class="wpc-price-tag">ক্রয়: ${money(p.purchasePrice)}/${p.unit||"কেজি"}</span>
        <button class="btn btn-sm btn-success wpc-sell-btn" onclick="quickSellWeightProduct('${p.id}')">
          <i class="fa-solid fa-cart-plus"></i> বিক্রি করুন
        </button>
      </div>
    </div>`;
  }).join("");
}

function quickSellWeightProduct(productId){
  // Switch to sales section and select this product in weight mode
  switchSection("sales");
  setTimeout(()=>{
    selectProduct(productId);
    // Auto enable weight mode
    if(!weightModeActive) toggleWeightMode();
    $("saleWeightQty")?.focus();
    showToast("ওজনভিত্তিক বিক্রয় মোড চালু — পরিমাণ লিখুন");
  }, 200);
}
window.quickSellWeightProduct=quickSellWeightProduct;
function setSaleType(type){
  currentSaleType=type;
  $("retailTypeBtn").classList.toggle("active-type",type==="খুচরা");
  $("wholesaleTypeBtn").classList.toggle("active-type",type==="পাইকারি");
  renderProductCards();
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
    const stock=safeNum(p.stock);
    const isLow=stock<=safeNum(p.lowStockLimit||5);
    const isZero=stock<=0;
    const isSelected=$("saleProduct")?.value===p.id;
    const hotTag=sold>5?`<div class="pcv2-hot">🔥 জনপ্রিয়</div>`:"";
    const price=currentSaleType==="পাইকারি"&&p.wholesalePrice?p.wholesalePrice:p.sellingPrice;
    const isSeed=p.mainCat==="বীজ";
    const isWeight=p.mainCat==="ওজনভিত্তিক"||p.isWeightProduct;
    const stockClass=isZero?"pcv2-stock-zero":isLow?"pcv2-stock-low":"pcv2-stock-ok";
    const catIcon=isWeight?"⚖️":isSeed?"🌱":"🧪";
    const catLabel=isWeight?"ওজনভিত্তিক":p.subCat||p.mainCat||"";
    return `<button type="button"
      class="pcv2 ${isZero?"pcv2-zero":isLow?"pcv2-low":""} ${isSelected?"pcv2-selected":""} ${isWeight?"pcv2-weight":""}"
      onclick="selectProduct('${p.id}')"
      ${isZero?'disabled':''}>
      ${hotTag}
      <div class="pcv2-cat">${catIcon} <span>${safeText(catLabel)}</span>${isWeight?`<span class="pcv2-weight-tag"><i class="fa-solid fa-weight-hanging"></i> ওজন</span>`:""}</div>
      <div class="pcv2-name">${safeText(p.name)}</div>
      ${p.brand?`<div class="pcv2-brand">${safeText(p.brand)}</div>`:""}
      <div class="pcv2-bottom">
        <div class="pcv2-price">${money(price)}/${p.unit||"পিস"}</div>
        <div class="pcv2-stock ${stockClass}">${isZero?"শেষ":`${stock} ${p.unit||""}`}</div>
      </div>
    </button>`;
  }).join("")||`<div class="prod-empty-v2"><i class="fa-solid fa-magnifying-glass"></i><p>কোনো পণ্য পাওয়া যায়নি</p></div>`;
}

function selectProduct(id){
  const p=products.find(x=>x.id===id); if(!p) return;
  $("saleProduct").value=id;
  const price=currentSaleType==="পাইকারি"&&p.wholesalePrice?p.wholesalePrice:p.sellingPrice;
  $("salePrice").value=price;
  $("saleQty").value="1";
  $("saleDiscount").value=0;
  // Weight mode price sync
  if($("saleWeightPrice")) $("saleWeightPrice").value=price;
  if($("saleWeightQty")) $("saleWeightQty").value="";
  if($("weightRemainingPreview")) $("weightRemainingPreview").style.display="none";

  // Auto-enable weight mode for weight products
  const isWeightProduct=p.mainCat==="ওজনভিত্তিক"||p.isWeightProduct;
  const weightUnits=["কেজি","গ্রাম","লিটার","মিলিলিটার"];
  const isWeightUnit=weightUnits.some(u=>(p.unit||"").toLowerCase().includes(u.toLowerCase()));
  if((isWeightProduct||isWeightUnit) && !weightModeActive){
    toggleWeightMode();
  } else if(!isWeightProduct && !isWeightUnit && weightModeActive){
    // keep weight mode if user chose it, don't force disable
  }

  // Update unit labels
  const unit=p.unit||"পিস";
  if($("qtyUnitLabel")) $("qtyUnitLabel").textContent=unit;
  if($("weightUnitLabel")) $("weightUnitLabel").textContent=unit;

  // Update weight stock info
  const wmStockInfo=$("weightStockInfo");
  if(wmStockInfo) wmStockInfo.textContent=`${p.stock} ${unit}`;

  const stockClass=safeNum(p.stock)<=safeNum(p.lowStockLimit||5)?"spc-low":"spc-ok";
  const isWeightProd=p.mainCat==="ওজনভিত্তিক"||p.isWeightProduct;
  const chip=$("selectedProductChip");
  if(chip) chip.innerHTML=`
    <div class="spc-info">
      <div class="spc-name">${safeText(p.name)}${p.variety?`<span class="variety-badge">${safeText(p.variety)}</span>`:""}${isWeightProd?`<span class="weight-sel-badge"><i class="fa-solid fa-weight-hanging"></i> ওজনভিত্তিক</span>`:""}</div>
      <div class="spc-meta">
        <span class="spc-price">মূল্য: ${money(price)}/${unit}</span>
        <span class="spc-stock ${stockClass}"><i class="fa-solid fa-boxes-stacked"></i> স্টক: ${p.stock} ${unit}</span>
        ${p.purchasePrice?`<span class="spc-purchase">ক্রয়: ${money(p.purchasePrice)}</span>`:""}
      </div>
    </div>`;
  // Show qty panel
  const qp=$("qtyPanel"); if(qp) qp.classList.add("active");
  renderProductCards();
  updateCartTotal();
  updateSaleLiveCalc();
  // Focus appropriate field
  if(weightModeActive) $("saleWeightQty")?.focus();
  else $("saleQty")?.focus();
}

/* ======= Weight Mode State ======= */
let weightModeActive = false;

function toggleWeightMode(){
  weightModeActive = !weightModeActive;
  const nm=$("normalQtyMode"), wm=$("weightQtyMode"), btn=$("weightModeBtn");
  if(nm) nm.style.display = weightModeActive ? "none" : "";
  if(wm) wm.style.display = weightModeActive ? "" : "none";
  if(btn){
    btn.classList.toggle("active", weightModeActive);
    btn.title = weightModeActive ? "সাধারণ মোডে ফিরুন" : "আংশিক/ওজনভিত্তিক মোড চালু করুন";
  }
  // Sync price if product selected
  const pid=$("saleProduct")?.value;
  if(pid && weightModeActive){
    const p=products.find(x=>x.id===pid);
    if(p){
      const price=currentSaleType==="পাইকারি"&&p.wholesalePrice?p.wholesalePrice:p.sellingPrice;
      if($("saleWeightPrice")) $("saleWeightPrice").value=price;
      updateWeightCalc();
    }
  }
}

function updateWeightCalc(){
  const pid=$("saleProduct")?.value;
  const p=pid?products.find(x=>x.id===pid):null;
  const qty=safeNum($("saleWeightQty")?.value);
  const price=safeNum($("saleWeightPrice")?.value);
  const preview=$("weightRemainingPreview");
  if(!p||qty<=0||price<=0){
    if(preview) preview.style.display="none";
    // Hide sold/remain from header
    const wmSold=$("wm-sold-preview"), wmRemain=$("wm-remain-preview"), wmDiv2=$("wm-divider-2");
    if(wmSold) wmSold.style.display="none";
    if(wmRemain) wmRemain.style.display="none";
    if(wmDiv2) wmDiv2.style.display="none";
    return;
  }
  const stock=safeNum(p.stock);
  const remaining=Math.max(0, Math.round((stock-qty)*1000)/1000);
  const total=Math.round(price*qty*100)/100;

  // Update header stock info
  const wmStockInfo=$("weightStockInfo");
  if(wmStockInfo) wmStockInfo.textContent=`${stock} ${p.unit||""}`;

  // Show sold/remain in header
  const wmSold=$("wm-sold-preview"), wmRemain=$("wm-remain-preview"), wmDiv2=$("wm-divider-2");
  if(wmSold) wmSold.style.display="";
  if(wmRemain) wmRemain.style.display="";
  if(wmDiv2) wmDiv2.style.display="";

  if($("wrpSold")) $("wrpSold").textContent=`${qty} ${p.unit||""}`;
  if($("wrpRemaining")) $("wrpRemaining").textContent=`${remaining} ${p.unit||""}`;
  if($("wrpTotal")) $("wrpTotal").textContent=money(total);
  if(preview) preview.style.display="";
}

function stepWeightQty(delta){
  const el=$("saleWeightQty"); if(!el) return;
  const current=safeNum(el.value)||0;
  el.value=Math.max(0.001, Math.round((current+delta)*1000)/1000);
  updateWeightCalc();
}
window.stepWeightQty=stepWeightQty;

function setWeightPreset(val){
  const el=$("saleWeightQty"); if(!el) return;
  el.value=val;
  updateWeightCalc();
}
window.setWeightPreset=setWeightPreset;

function stepQty(delta){
  const el=$("saleQty"); if(!el) return;
  const pid=$("saleProduct")?.value;
  const p=pid?products.find(x=>x.id===pid):null;
  // Weight-friendly units allow decimal steps
  const weightUnits=["কেজি","গ্রাম","লিটার","মিলিলিটার","কেজি (kg)","লিটার (L)","গ্রাম (g)"];
  const isWeight=p&&weightUnits.some(u=>(p.unit||"").toLowerCase().includes(u.toLowerCase().split(" ")[0]));
  const step=isWeight?0.5:1;
  const current=safeNum(el.value)||0;
  el.value=Math.max(step, Math.round((current+delta*step)*1000)/1000);
  updateSaleLiveCalc();
}

function clearProductSearch(){
  const el=$("productDropdownSearch"); if(el) el.value="";
  const cb=$("clearProdSearch"); if(cb) cb.style.display="none";
  renderProductCards();
}

function updateSaleLiveCalc(){
  const pid=$("saleProduct")?.value;
  const p=pid?products.find(x=>x.id===pid):null;
  const qty=safeNum($("saleQty")?.value);
  const price=safeNum($("salePrice")?.value);
  const discount=safeNum($("saleDiscount")?.value||0);
  const box=$("liveCalcBox");
  if(!p||qty<=0||price<=0){ if(box) box.style.display="none"; return; }
  const total=Math.max(0,(price*qty)-discount);
  const profit=Math.max(0,((price-safeNum(p.purchasePrice))*qty)-discount);
  if($("lcTotal")) $("lcTotal").textContent=money(total);
  if($("lcProfit")) $("lcProfit").textContent=money(profit);
  if(box) box.style.display="";
}

function addToCart(){
  const pid=$("saleProduct")?.value;
  if(!pid) return showToast("পণ্য নির্বাচন করুন");
  const product=products.find(p=>p.id===pid);
  if(!product) return showToast("পণ্য পাওয়া যায়নি");

  let qty, price, discount=0;

  if(weightModeActive){
    // Weight/partial mode — allows decimals
    qty=safeNum($("saleWeightQty")?.value);
    price=safeNum($("saleWeightPrice")?.value);
    if(qty<=0) return showToast("সঠিক পরিমাণ/ওজন দিন");
    if(price<=0) return showToast("সঠিক মূল্য দিন");
  } else {
    qty=safeNum($("saleQty")?.value);
    price=safeNum($("salePrice")?.value);
    discount=safeNum($("saleDiscount")?.value||0);
    if(qty<=0) return showToast("সঠিক পরিমাণ দিন");
    if(price<=0) return showToast("সঠিক মূল্য দিন");
    if(discount<0) return showToast("ছাড় মাইনাস হতে পারবে না");
    if(discount>price*qty) return showToast("ছাড় বেশি হয়ে গেছে");
  }

  const cartQty=getCartQtyForProduct(pid);
  if(safeNum(product.stock)<qty+cartQty)
    return showToast(`স্টক পর্যাপ্ত নেই (বাকি: ${Math.round((safeNum(product.stock)-cartQty)*1000)/1000} ${product.unit||""})`);

  const total=Math.max(0,(price*qty)-discount);
  const purchaseP=safeNum(product.purchasePrice);
  const profit=Math.max(0,((price-purchaseP)*qty)-discount);
  const isWeightSale=weightModeActive;

  saleCart.push({
    productId:product.id, productName:product.name,
    mainCat:product.mainCat||"",
    unit:product.unit||"",
    quantity:qty, price, discount, total, profit,
    purchasePrice:purchaseP,
    isWeightSale
  });

  // Reset fields
  $("saleProduct").value="";
  if($("saleQty")) $("saleQty").value="";
  if($("salePrice")) $("salePrice").value="";
  if($("saleDiscount")) $("saleDiscount").value=0;
  if($("saleWeightQty")) $("saleWeightQty").value="";
  if($("saleWeightPrice")) $("saleWeightPrice").value="";
  if($("weightRemainingPreview")) $("weightRemainingPreview").style.display="none";
  if($("liveCalcBox")) $("liveCalcBox").style.display="none";
  const chip=$("selectedProductChip");
  if(chip) chip.innerHTML=`<div class="spc-empty"><i class="fa-regular fa-hand-pointer"></i> উপর থেকে পণ্য বেছে নিন</div>`;
  renderProductCards(); renderCart();
  showToast(`${product.name} কার্টে যোগ হয়েছে ✓`);
  return true;
}

function removeFromCart(idx){ saleCart.splice(idx,1); renderCart(); renderProductCards(); }

function renderCart(){
  const list=$("saleCartList"), badge=$("saleCartCount");
  if(badge) badge.textContent=`${saleCart.length} পণ্য`;
  if(!list) return;
  if(!saleCart.length){
    list.innerHTML=`<div class="cart-empty-v2"><i class="fa-regular fa-cart-shopping"></i><p>কোনো পণ্য যোগ হয়নি</p></div>`;
    updateCartTotal(); return;
  }
  list.innerHTML=saleCart.map((item,i)=>{
    const qtyDisplay=Number.isInteger(item.quantity)?item.quantity:(Math.round(item.quantity*1000)/1000);
    const weightTag=item.isWeightSale?`<span class="weight-cart-tag"><i class="fa-solid fa-scale-balanced"></i> আংশিক</span>`:"";
    return `
    <div class="cart-item-v2">
      <div class="civ2-info">
        <div class="civ2-name">${safeText(item.productName)} ${weightTag}</div>
        <div class="civ2-meta">${qtyDisplay} ${item.unit||""} × ${money(item.price)}${safeNum(item.discount)?` · ছাড়: ${money(item.discount)}`:""}</div>
        <div class="civ2-profit">লাভ: ${money(item.profit)}</div>
      </div>
      <div class="civ2-right">
        <strong class="civ2-total">${money(item.total)}</strong>
        <button type="button" class="civ2-remove" onclick="removeFromCart(${i})"><i class="fa-solid fa-xmark"></i></button>
      </div>
    </div>`;
  }).join("");
  updateCartTotal();
}

function updateCartTotal(){
  const total=saleCart.reduce((s,x)=>s+safeNum(x.total),0);
  const profit=saleCart.reduce((s,x)=>s+safeNum(x.profit),0);
  if($("saleTotalPreview")) $("saleTotalPreview").textContent=money(total);
  const profLine=$("cartProfitLine");
  if(profLine){
    profLine.style.display=saleCart.length?"":"none";
    if($("cartTotalProfit")) $("cartTotalProfit").textContent=money(profit);
  }
  if($("saleMethod")?.value==="আংশিক") calcPartialDue();
}

/* Payment Methods */
function initPaymentMethods(){
  // Handle both old .pmb and new .pmb-v2
  document.querySelectorAll(".pmb, .pmb-v2").forEach(btn=>{
    btn.addEventListener("click",()=>{
      document.querySelectorAll(".pmb, .pmb-v2").forEach(b=>b.classList.remove("active-method"));
      btn.classList.add("active-method");
      const val=btn.dataset.method;
      if($("saleMethod")) $("saleMethod").value=val;
      $("partialPayFields").style.display=val==="আংশিক"?"":"none";
      $("fullDueFields").style.display=val==="সম্পূর্ণ বাকি"?"":"none";
      if(val==="আংশিক") calcPartialDue();
    });
  });
}

function updateSalesStatsBar(){
  const today=todayISO();
  const todaySalesList=sales.filter(s=>s.date===today);
  const todayTotal=todaySalesList.reduce((s,x)=>s+safeNum(x.total),0);
  const todayProfit=todaySalesList.reduce((s,x)=>s+safeNum(x.profit),0);
  const weightCount=todaySalesList.filter(s=>s.items&&s.items.some(i=>i.isWeightSale)).length;
  if($("saleBarToday")) $("saleBarToday").textContent=money(todayTotal);
  if($("saleBarProfit")) $("saleBarProfit").textContent=money(todayProfit);
  if($("saleBarCount")) $("saleBarCount").textContent=todaySalesList.length;
  if($("saleBarWeight")) $("saleBarWeight").textContent=weightCount;
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

  /* ================================================================
     পেমেন্ট লজিক:
     - সম্পূর্ণ নগদ → paidAmount=total, dueAmount=0
     - মোবাইল ব্যাংকিং → paidAmount=total, dueAmount=0
     - আংশিক → paidAmount=যা দিয়েছে, dueAmount=বাকি
     - সম্পূর্ণ বাকি → paidAmount=0, dueAmount=total
  ================================================================ */
  let paidAmount;
  if(payMethod==="আংশিক"){
    paidAmount=Math.min(total, Math.max(0, safeNum($("salePaidAmount")?.value||0)));
  } else if(payMethod==="সম্পূর্ণ নগদ"||payMethod==="মোবাইল ব্যাংকিং"){
    paidAmount=total;
  } else {
    // সম্পূর্ণ বাকি
    paidAmount=0;
  }
  const dueAmt=Math.max(0, Math.round((total-paidAmount)*100)/100);
  const dueDate=payMethod==="আংশিক"?$("saleDueDate")?.value
    :payMethod==="সম্পূর্ণ বাকি"?$("saleDueDateFull")?.value:"";

  // Deduct stock
  products=products.map(product=>{
    const soldQty=items.filter(x=>x.productId===product.id)
      .reduce((s,x)=>s+safeNum(x.quantity),0);
    if(!soldQty) return product;
    return{...product,stock:Math.max(0,safeNum(product.stock)-soldQty),updatedAt:new Date().toISOString()};
  });

  /* storedPayMethod:
     - "সম্পূর্ণ নগদ" → sales এ নগদ হিসেবে থাকবে
     - "মোবাইল ব্যাংকিং" → Mobile হিসেবে থাকবে
     - "আংশিক" → "নগদ+বাকি" হিসেবে সেভ হবে (paidAmount ও dueAmount দুটোই আছে)
     - "সম্পূর্ণ বাকি" → Due হিসেবে থাকবে
  */
  const storedPayMethod = payMethod==="আংশিক"
    ? (dueAmt>0?"নগদ+বাকি":"সম্পূর্ণ নগদ")
    : payMethod;

  const sale={
    id:uid("sale"),
    saleType:currentSaleType,
    productId:items.length===1?items[0].productId:"multiple",
    productName:items.map(x=>x.productName).join(", "),
    quantity:totalQty, price:items.length===1?items[0].price:0,
    discount, total, profit, items,
    paymentMethod:storedPayMethod,
    paidAmount,
    dueAmount:dueAmt,
    customerName:($("saleCustomer")?.value||"").trim(),
    customerPhone:($("salePhone")?.value||"").trim(),
    village:($("saleVillage")?.value||"").trim(),
    note:($("saleNote")?.value||"").trim(),
    date:todayISO(), createdAt:new Date().toISOString()
  };
  sales=[sale,...sales];
  lastInvoice=sale;

  /*
    Due Entry তৈরির নিয়ম:
    - dueAmount > 0 হলে due entry তৈরি হবে
    - due entry তে paidAmount = sale এর paidAmount (আংশিক পেমেন্টের নগদ অংশ)
    - Due Entry তে payment[] array তে প্রথম payment টি রাখা হয় যদি paidAmount > 0
    
    গুরুত্বপূর্ণ: due.payments[] এ যা থাকবে সেটা "বাকি আদায়" হিসেবে গণনা হবে।
    বিক্রয়ের সময় আংশিক payment → sale.paidAmount এ থাকবে, due.payments এ থাকবে না।
    পরবর্তীতে collectDue থেকে আদায় হলে due.payments এ যাবে।
  */
  if(dueAmt>0){
    dues=[{
      id:uid("due"),
      customerName:sale.customerName||"অজানা ক্রেতা",
      phone:sale.customerPhone, village:sale.village,
      productName:sale.productName,
      totalAmount:total,
      paidAmount,
      dueAmount:dueAmt,
      status:"বকেয়া",
      dueDate:dueDate||"",
      date:todayISO(), createdAt:new Date().toISOString(),
      payments:[]  // বিক্রয়ের সময় partial payment, due.payments এ যায় না
    },...dues];
    await saveNode("dues",dues);
  }

  await saveNode("products",products);
  await saveNode("sales",sales);

  saleCart=[];
  $("saleForm").reset();
  $("saleProduct").value="";
  const chip=$("selectedProductChip");
  if(chip) chip.innerHTML=`<div class="spc-empty"><i class="fa-regular fa-hand-pointer"></i> উপর থেকে পণ্য বেছে নিন</div>`;
  // Reset weight mode
  if(weightModeActive){ weightModeActive=false; const nm=$("normalQtyMode"),wm=$("weightQtyMode"),btn=$("weightModeBtn"); if(nm)nm.style.display=""; if(wm)wm.style.display="none"; if(btn)btn.classList.remove("active"); }
  if($("weightRemainingPreview")) $("weightRemainingPreview").style.display="none";
  if($("liveCalcBox")) $("liveCalcBox").style.display="none";
  const qp=$("qtyPanel"); if(qp) qp.classList.remove("active");
  document.querySelectorAll(".pmb,.pmb-v2").forEach(b=>b.classList.remove("active-method"));
  const cashBtn=document.querySelector('.pmb-v2[data-method="সম্পূর্ণ নগদ"]')||document.querySelector('.pmb[data-method="সম্পূর্ণ নগদ"]');
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

  const infoBar=$("salesHistoryInfo");
  if(infoBar){
    infoBar.innerHTML=showAllHistory
      ?`<i class="fa-solid fa-list"></i> সব সময়ের <b>${list.length}টি</b> বিক্রয় দেখানো হচ্ছে`
      :`<i class="fa-solid fa-calendar-day"></i> আজকের <b>${list.length}টি</b> বিক্রয় — সব দেখতে উপরের বাটন চাপুন`;
  }

  const tbody=$("salesTable"); if(!tbody) return;

  /* Pagination: সব ইতিহাসে ৫০টি করে দেখাও */
  const showPagination = showAllHistory && list.length > salesPageSize;
  if(!showAllHistory) { salesPageOffset=0; }
  const displayList = showPagination
    ? list.slice(salesPageOffset, salesPageOffset + salesPageSize)
    : list;

  tbody.innerHTML=displayList.map(s=>{
    const pmClass = s.paymentMethod==="সম্পূর্ণ নগদ"?"cash"
      :s.paymentMethod==="মোবাইল ব্যাংকিং"?"mobile"
      :s.paymentMethod==="সম্পূর্ণ বাকি"?"due"
      :s.paymentMethod==="নগদ+বাকি"||s.paymentMethod==="আংশিক"?"partial"
      :s.paymentMethod==="পরিশোধিত"?"settled":"cash";
    const pmLabel = s.paymentMethod==="পরিশোধিত"?"✓ পরিশোধিত"
      :s.paymentMethod==="নগদ+বাকি"?"নগদ+বাকি":s.paymentMethod;
    const typeClass = s.saleType==="পাইকারি"?"wholesale":"retail";
    return `
    <tr>
      <td>
        <div style="font-size:.82rem;font-weight:600;color:var(--text-1)">${s.date}</div>
        <div style="font-size:.72rem;color:var(--text-4)">${formatTime(s)}</div>
      </td>
      <td>
        <div style="font-weight:700;color:var(--text-1);font-size:.84rem">${safeText(s.productName)}</div>
        ${s.note?`<div style="font-size:.72rem;color:var(--text-3)">${safeText(s.note)}</div>`:""}
      </td>
      <td>
        <div style="font-size:.83rem;color:var(--text-1)">${s.customerName?safeText(s.customerName):"-"}</div>
        ${s.village?`<div style="font-size:.72rem;color:var(--text-4)">${safeText(s.village)}</div>`:""}
      </td>
      <td style="text-align:center;font-weight:700">${s.quantity}</td>
      <td style="text-align:right;font-weight:800;color:var(--brand)">${money(s.total)}</td>
      <td style="text-align:right;font-weight:700;color:var(--accent-2)">${money(s.profit)}</td>
      <td style="text-align:center"><span class="sale-type-badge ${typeClass}">${s.saleType||"খুচরা"}</span></td>
      <td style="text-align:center"><span class="payment-badge-sm ${pmClass}">${pmLabel}</span></td>
      <td>
        <div class="action-row">
          <button class="btn btn-sm btn-outline" onclick="printSaleInvoice('${s.id}')" title="ইনভয়েস প্রিন্ট"><i class="fa-solid fa-print"></i></button>
          <button class="btn btn-sm btn-danger" onclick="deleteSale('${s.id}')" title="মুছুন"><i class="fa-solid fa-trash"></i></button>
        </div>
      </td>
    </tr>`;
  }).join("")
    ||`<tr><td colspan="9" class="tbl-empty"><i class="fa-solid fa-receipt"></i><br>কোনো বিক্রয় পাওয়া যায়নি</td></tr>`;

  /* Pagination controls */
  const paginationWrap = $("salesPaginationWrap");
  if(paginationWrap){
    if(showPagination){
      const totalPages = Math.ceil(list.length / salesPageSize);
      const currentPage = Math.floor(salesPageOffset / salesPageSize) + 1;
      paginationWrap.style.display = "";
      paginationWrap.innerHTML = `
        <div class="pagination-bar">
          <span class="pg-info">পৃষ্ঠা ${currentPage} / ${totalPages} — মোট ${list.length}টি</span>
          <div class="pg-btns">
            <button class="btn btn-sm btn-outline" onclick="salesPrevPage()" ${salesPageOffset===0?'disabled':''}>
              <i class="fa-solid fa-chevron-left"></i> আগের
            </button>
            <button class="btn btn-sm btn-outline" onclick="salesNextPage()" ${salesPageOffset+salesPageSize>=list.length?'disabled':''}>
              পরের <i class="fa-solid fa-chevron-right"></i>
            </button>
          </div>
        </div>`;
    } else {
      paginationWrap.style.display = "none";
    }
  }
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
  const newDue=Math.max(0, Math.round((rem-amt)*100)/100);
  const isPaidOff=newDue<=0;

  dues=dues.map(x=>x.id===id?{
    ...x,
    paidAmount:newPaid,
    dueAmount:newDue,
    status:isPaidOff?"পরিশোধিত":"বকেয়া",
    lastPayDate:todayISO(),
    /*
      FIX: due.payments[] শুধুমাত্র collectDue থেকে আদায়কৃত অর্থ রাখে।
      বিক্রয়ের সময়ের paidAmount এখানে যায় না।
      তাই cashInShop calculation এ double-count হবে না।
    */
    payments:[...(x.payments||[]),{amount:amt,date:todayISO(),createdAt:new Date().toISOString()}]
  }:x);

  if(isPaidOff){
    // Update related sale status only — amount পরিবর্তন করি না
    sales=sales.map(s=>{
      if((s.customerName===d.customerName||s.customerPhone===d.phone)&&safeNum(s.dueAmount)>0){
        return {...s, paymentMethod:"পরিশোধিত", dueAmount:0, paidAmount:safeNum(s.total)};
      }
      return s;
    });
    await saveNode("sales",sales);
    showToast(`${money(amt)} আদায় হয়েছে — বাকি সম্পূর্ণ পরিশোধ ✓`);
    setTimeout(async()=>{
      dues=dues.filter(x=>x.id!==id);
      await saveNode("dues",dues);
      renderAll();
      showToast("পরিশোধিত বাকি তালিকা থেকে মুছে গেছে");
    },2000);
    // dues already saved inside setTimeout; skip redundant save below
    renderAll();
    return;
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

  const activeDues=dues.filter(d=>safeNum(d.dueAmount)>0);
  const totalDueSum=activeDues.reduce((s,d)=>s+safeNum(d.dueAmount),0);
  // dueSumPaid = due.payments থেকে আদায়কৃত (বিক্রয়ের সময়ের পেমেন্ট বাদ)
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
          <div class="dv" style="color:${isPaid?'var(--green-dark)':'var(--soil-mid)'}"> ${money(d.dueAmount)}</div>
        </div>
        <div class="due-detail-item">
          <div class="dl">তারিখ</div>
          <div class="dv">${d.dueDate||d.date||"-"}</div>
        </div>
      </div>

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

/* ===================== Cash Calculation (Central) ===================== */
/*
  দোকানে বর্তমান নগদ (cashInShop) হিসাব পদ্ধতি:
  =====================================================
  নগদ আসে:
    ১. সম্পূর্ণ নগদ বিক্রয় → sale.total (paymentMethod="সম্পূর্ণ নগদ")
    ২. মোবাইল ব্যাংকিং বিক্রয় → sale.total (paymentMethod="মোবাইল ব্যাংকিং")
    ৩. আংশিক/নগদ+বাকি বিক্রয় → sale.paidAmount (paymentMethod="নগদ+বাকি")
    ৪. পরবর্তীতে বাকি আদায় → due.payments[].amount (collectDue থেকে)

  নগদ যায়:
    - উত্তোলন → withdrawals[].amount

  গুরুত্বপূর্ণ নিয়ম:
    - "পরিশোধিত" sales এ paidAmount=total কিন্তু এটা originally
      নগদ/মোবাইল হিসেবে counted হয়েছে, তাই "পরিশোধিত" ধরে আবার count করা হবে না।
    - due.payments[] → শুধু collectDue() থেকে আসা আদায়
    - sale.paidAmount → বিক্রয়ের সময় নেওয়া অর্থ (partial payment)
*/
function calcCashInShop(){
  // নগদ বিক্রয় (paymentMethod = সম্পূর্ণ নগদ)
  const cashSales = sales
    .filter(s => s.paymentMethod === "সম্পূর্ণ নগদ")
    .reduce((s, x) => s + safeNum(x.total), 0);

  // মোবাইল ব্যাংকিং বিক্রয়
  const mobileSales = sales
    .filter(s => s.paymentMethod === "মোবাইল ব্যাংকিং")
    .reduce((s, x) => s + safeNum(x.total), 0);

  // আংশিক বিক্রয়ের নগদ অংশ (বিক্রয়ের সময় নেওয়া)
  const partialPaid = sales
    .filter(s => s.paymentMethod === "নগদ+বাকি" || s.paymentMethod === "আংশিক")
    .reduce((s, x) => s + safeNum(x.paidAmount || 0), 0);

  // বাকি আদায় — শুধু due.payments থেকে (double count এড়াতে)
  // "পরিশোধিত" হলেও due.payments এই থাকবে
  const dueCollected = dues.reduce((s, d) =>
    s + (d.payments || []).reduce((a, p) => a + safeNum(p.amount), 0), 0
  );

  return cashSales + mobileSales + partialPaid + dueCollected;
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

  // আজ আদায় (শুধু due.payments থেকে, আজকের তারিখ)
  let todayCollectedAmt=0;
  dues.forEach(d=>(d.payments||[]).forEach(p=>{
    if(p.date===today) todayCollectedAmt+=safeNum(p.amount);
  }));

  const lowStockCount=products.filter(p=>safeNum(p.stock)<=safeNum(p.lowStockLimit||5)).length;
  const totalStockVal=products.reduce((s,p)=>s+safeNum(p.stock)*safeNum(p.purchasePrice),0);
  const wholesaleProfit=todaySalesList.filter(s=>s.saleType==="পাইকারি").reduce((s,x)=>s+safeNum(x.profit),0);
  const retailProfit=todaySalesList.filter(s=>s.saleType==="খুচরা").reduce((s,x)=>s+safeNum(x.profit),0);

  const totalProductCount=products.length;
  const seedProductCount=products.filter(p=>p.mainCat==="বীজ").length;
  const pestProductCount=products.filter(p=>p.mainCat==="কীটনাশক").length;

  // দোকানে বর্তমান নগদ (central calculation)
  const grossCash = calcCashInShop();
  const totalWithdrawn = withdrawals.reduce((s,w)=>s+safeNum(w.amount),0);
  const cashInShop = Math.max(0, grossCash - totalWithdrawn);

  // আজকের নগদ বিভাজন
  const todayCashSalesAmt = todaySalesList
    .filter(s=>s.paymentMethod==="সম্পূর্ণ নগদ")
    .reduce((s,x)=>s+safeNum(x.total),0);
  const todayMobileAmt = todaySalesList
    .filter(s=>s.paymentMethod==="মোবাইল ব্যাংকিং")
    .reduce((s,x)=>s+safeNum(x.total),0);
  const todayPartialPaid = todaySalesList
    .filter(s=>s.paymentMethod==="নগদ+বাকি"||s.paymentMethod==="আংশিক")
    .reduce((s,x)=>s+safeNum(x.paidAmount||0),0);
  const todayCashTotal = todayCashSalesAmt + todayMobileAmt + todayPartialPaid;
  const todayDueSalesAmt = todaySalesList.reduce((s,x)=>s+safeNum(x.dueAmount||0),0);

  // KPI আপডেট
  $("todaySales").textContent=money(totalSalesAmt);
  $("todayProfit").textContent=money(totalProfitAmt);
  $("wholesaleSales").textContent=money(wholesaleAmt);
  $("retailSales").textContent=money(retailAmt);
  $("totalDue").textContent=money(totalDueAmt);
  $("todayCollection").textContent=money(todayCollectedAmt);
  $("lowStockCount").textContent=lowStockCount;
  $("totalStockValue").textContent=money(totalStockVal);

  if($("todaySaleCountLabel")) $("todaySaleCountLabel").textContent=`${todaySalesList.length}টি বিক্রয়`;

  if($("todayCashSalesCard")) $("todayCashSalesCard").textContent=money(todayCashTotal);
  if($("todayCashAddedCard")) $("todayCashAddedCard").textContent=money(todayCashTotal);
  if($("todayDueSalesCard")) $("todayDueSalesCard").textContent=money(todayDueSalesAmt);
  if($("todayPartialSalesCard")) $("todayPartialSalesCard").textContent=money(todayPartialPaid);

  if($("totalProductCount")) $("totalProductCount").textContent=totalProductCount;
  if($("seedProductCount"))  $("seedProductCount").textContent=seedProductCount;
  if($("pestProductCount"))  $("pestProductCount").textContent=pestProductCount;
  if($("wholesaleDashProfit")) $("wholesaleDashProfit").textContent=money(wholesaleProfit);
  if($("retailDashProfit")) $("retailDashProfit").textContent=money(retailProfit);

  // Seed/Pest sales breakdown
  const todaySeedSalesAmt = todaySalesList.reduce((s,x)=>
    s+(x.items||[{productId:x.productId,total:x.total}])
      .filter(i=>i.mainCat==="বীজ"||products.find(p=>p.id===i.productId)?.mainCat==="বীজ")
      .reduce((a,b)=>a+safeNum(b.total),0),0);
  const todayPestSalesAmt = todaySalesList.reduce((s,x)=>
    s+(x.items||[{productId:x.productId,total:x.total}])
      .filter(i=>i.mainCat==="কীটনাশক"||products.find(p=>p.id===i.productId)?.mainCat==="কীটনাশক")
      .reduce((a,b)=>a+safeNum(b.total),0),0);

  if($("todaySeedSales")) $("todaySeedSales").textContent=money(todaySeedSalesAmt);
  if($("todayPestSales")) $("todayPestSales").textContent=money(todayPestSalesAmt);
  // hidden spans (backward compat)
  if($("todayCashSales")) $("todayCashSales").textContent=money(todayCashSalesAmt);
  if($("todayMobileSales")) $("todayMobileSales").textContent=money(todayMobileAmt);

  // দোকানে বর্তমান নগদ (উত্তোলন বাদ দিয়ে)
  if($("cashInHand")) $("cashInHand").textContent=money(cashInShop);

  renderWithdrawBalance();

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

  renderDueReminders();
  buildNotifications();
  updatePartialSoldDashboard();
  updateWeightDashboard();
}

function updateWeightDashboard(){
  const weightProds=products.filter(p=>p.mainCat==="ওজনভিত্তিক"||p.isWeightProduct);
  const totalWeightStock=weightProds.reduce((s,p)=>s+safeNum(p.stock),0);
  const weightSales=sales.filter(s=>
    (s.items||[{isWeightSale:s.isWeightSale}]).some(i=>i.isWeightSale)
  );

  if($("weightProductCount")) $("weightProductCount").textContent=weightProds.length;
  if($("weightTotalStock")) $("weightTotalStock").textContent=totalWeightStock+" ইউনিট";
  if($("weightSaleCount")) $("weightSaleCount").textContent=weightSales.length;
  if($("weightProductCountLabel")) $("weightProductCountLabel").textContent=`${weightProds.length}টি পণ্য স্টকে`;
}

function renderDueReminders(){
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

  const seedSales=filteredSales.reduce((s,x)=>
    s+(x.items||[{productId:x.productId,total:x.total,mainCat:x.mainCat}])
      .filter(i=>i.mainCat==="বীজ"||products.find(p=>p.id===i.productId)?.mainCat==="বীজ")
      .reduce((a,b)=>a+safeNum(b.total),0),0);
  const pestSales=filteredSales.reduce((s,x)=>
    s+(x.items||[{productId:x.productId,total:x.total,mainCat:x.mainCat}])
      .filter(i=>i.mainCat==="কীটনাশক"||products.find(p=>p.id===i.productId)?.mainCat==="কীটনাশক")
      .reduce((a,b)=>a+safeNum(b.total),0),0);

  const totalDue=dues.filter(d=>safeNum(d.dueAmount)>0).reduce((s,d)=>s+safeNum(d.dueAmount),0);

  // বাকি আদায় — period অনুযায়ী
  let periodCollection=0;
  dues.forEach(d=>(d.payments||[]).forEach(p=>{
    if(period==="today"&&p.date===today) periodCollection+=safeNum(p.amount);
    else if(period==="month"&&(p.date||"").startsWith(month)) periodCollection+=safeNum(p.amount);
    else if(period==="all") periodCollection+=safeNum(p.amount);
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
    <div class="acc-card-v2 gold"><span class="acc-label"><i class="fa-solid fa-hand-holding-dollar"></i> বাকি আদায়</span><div class="acc-val">${money(periodCollection)}</div></div>
  `;

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

  // নগদ প্রাপ্ত = নগদ + মোবাইল + আংশিকের paidAmount
  const paidSales =
    fs.filter(s=>s.paymentMethod==="সম্পূর্ণ নগদ").reduce((s,x)=>s+safeNum(x.total),0) +
    fs.filter(s=>s.paymentMethod==="মোবাইল ব্যাংকিং").reduce((s,x)=>s+safeNum(x.total),0) +
    fs.filter(s=>s.paymentMethod==="আংশিক"||s.paymentMethod==="নগদ+বাকি").reduce((s,x)=>s+safeNum(x.paidAmount||0),0);

  // বাকি = filter করা sales এ dueAmount এর যোগফল
  const dueSales = fs.reduce((s,x)=>s+safeNum(x.dueAmount||0),0);

  const totalDue=dues.filter(d=>safeNum(d.dueAmount)>0).reduce((s,d)=>s+safeNum(d.dueAmount),0);

  // বাকি আদায় — period অনুযায়ী
  let dueCollection=0;
  dues.forEach(d=>(d.payments||[]).forEach(p=>{
    if(filter==="daily"&&p.date===today) dueCollection+=safeNum(p.amount);
    else if(filter==="monthly"&&(p.date||"").startsWith(month)) dueCollection+=safeNum(p.amount);
    else if(filter==="all") dueCollection+=safeNum(p.amount);
  }));

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
  const paidSales    =
    filteredSales.filter(s=>s.paymentMethod==="সম্পূর্ণ নগদ").reduce((s,x)=>s+safeNum(x.total),0) +
    filteredSales.filter(s=>s.paymentMethod==="আংশিক"||s.paymentMethod==="নগদ+বাকি").reduce((s,x)=>s+safeNum(x.paidAmount||0),0) +
    filteredSales.filter(s=>s.paymentMethod==="মোবাইল ব্যাংকিং").reduce((s,x)=>s+safeNum(x.total),0);
  const dueSales     = filteredSales.reduce((s,x)=>s+safeNum(x.dueAmount||0),0);
  const totalDiscount= filteredSales.reduce((s,x)=>s+safeNum(x.discount||0),0);

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
    ${safeNum(s.paidAmount)>0&&safeNum(s.dueAmount)>0?`<p style="font-size:.85rem;margin:5px 0"><b>প্রদত্ত:</b> ${money(s.paidAmount)}</p>`:""}
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

/* ===================== Withdraw System ===================== */

function renderWithdrawBalance(){
  // Central cash calculation
  const grossCash = calcCashInShop();
  const totalWithdrawn = withdrawals.reduce((s,w)=>s+safeNum(w.amount),0);
  const balance = Math.max(0, grossCash - totalWithdrawn);

  if($("withdrawableBalance")) $("withdrawableBalance").textContent=money(balance);
  if($("totalWithdrawnAmt")) $("totalWithdrawnAmt").textContent=money(totalWithdrawn);
  // cashInHand dashboard card sync
  if($("cashInHand")) $("cashInHand").textContent=money(balance);
  renderWithdrawHistory();
}

function renderWithdrawHistory(){
  const list=$("withdrawHistoryList"); if(!list) return;
  if(!withdrawals.length){
    list.innerHTML=`<div class="withdraw-empty"><i class="fa-solid fa-arrow-up-from-bracket"></i><p>এখনো কোনো উত্তোলন করা হয়নি</p></div>`;
    return;
  }
  list.innerHTML=[...withdrawals].sort((a,b)=>(b.createdAt||"").localeCompare(a.createdAt||"")).map(w=>`
    <div class="withdraw-item">
      <div class="wi-icon"><i class="fa-solid fa-arrow-up-from-bracket"></i></div>
      <div class="wi-body">
        <div class="wi-amount">${money(w.amount)}</div>
        ${w.note?`<div class="wi-note"><i class="fa-solid fa-note-sticky"></i> ${safeText(w.note)}</div>`:""}
        <div class="wi-meta"><i class="fa-regular fa-calendar"></i> ${w.date}${w.createdAt?` · ${new Date(w.createdAt).toLocaleTimeString("en-BD",{hour:"2-digit",minute:"2-digit"})}`:""}</div>
      </div>
      <button class="wi-delete" onclick="deleteWithdrawal('${w.id}')" title="মুছুন"><i class="fa-solid fa-trash"></i></button>
    </div>`).join("");
}

async function handleWithdraw(){
  const amtVal=$("withdrawAmount")?.value;
  const date=$("withdrawDate")?.value;
  const note=$("withdrawNote")?.value||"";
  if(!amtVal||safeNum(amtVal)<=0) return showToast("সঠিক পরিমাণ লিখুন");
  if(!date) return showToast("তারিখ নির্বাচন করুন");
  const amt=safeNum(amtVal);

  // Central calculation এ সঠিক balance check
  const grossCash = calcCashInShop();
  const totalWithdrawn = withdrawals.reduce((s,w)=>s+safeNum(w.amount),0);
  const balance = grossCash - totalWithdrawn;

  if(amt>balance) return showToast(`পর্যাপ্ত নগদ নেই। উত্তোলনযোগ্য: ${money(Math.max(0,balance))}`);

  withdrawals=[{
    id:uid("wd"),
    amount:amt, date, note:note.trim(),
    createdAt:new Date().toISOString()
  },...withdrawals];
  setLocal("agri_withdrawals",withdrawals);
  if(firebaseReady&&db){
    try{ await db.ref("withdrawals").set(withdrawals); } catch(e){}
  }
  $("withdrawAmount").value="";
  $("withdrawNote").value="";
  renderWithdrawBalance();
  // renderAll() → dashboard cashInHand আপডেট হবে renderWithdrawBalance() থেকেই
  showToast(`${money(amt)} উত্তোলন সম্পন্ন ✓`);
}

async function deleteWithdrawal(id){
  if(!confirm("এই উত্তোলন রেকর্ড মুছে ফেলবেন?")) return;
  withdrawals=withdrawals.filter(w=>w.id!==id);
  setLocal("agri_withdrawals",withdrawals);
  if(firebaseReady&&db){
    try{ await db.ref("withdrawals").set(withdrawals); } catch(e){}
  }
  renderWithdrawBalance();
  showToast("উত্তোলন রেকর্ড মুছে গেছে");
}
window.deleteWithdrawal=deleteWithdrawal;

/* ===================== Dashboard Card Detail Modal ===================== */

function showCardDetail(cardType){
  const modal=$("detailModal");
  const title=$("detailModalTitle");
  const summary=$("detailModalSummary");
  const body=$("detailModalBody");
  if(!modal) return;

  const today=todayISO();

  switch(cardType){
    case "todaySales": {
      title.innerHTML=`<i class="fa-solid fa-sack-dollar"></i> আজকের বিক্রয় বিস্তারিত`;
      const list=sales.filter(s=>s.date===today);
      const total=list.reduce((s,x)=>s+safeNum(x.total),0);
      const cashAmt=
        list.filter(s=>s.paymentMethod==="সম্পূর্ণ নগদ").reduce((s,x)=>s+safeNum(x.total),0) +
        list.filter(s=>s.paymentMethod==="মোবাইল ব্যাংকিং").reduce((s,x)=>s+safeNum(x.total),0) +
        list.filter(s=>s.paymentMethod==="নগদ+বাকি"||s.paymentMethod==="আংশিক").reduce((s,x)=>s+safeNum(x.paidAmount||0),0);
      const dueAmt=list.reduce((s,x)=>s+safeNum(x.dueAmount||0),0);
      summary.innerHTML=`<div class="dm-sum-grid">
        <div class="dm-sum-item green"><span>মোট বিক্রয়</span><strong>${money(total)}</strong></div>
        <div class="dm-sum-item teal"><span>নগদ প্রাপ্ত</span><strong>${money(cashAmt)}</strong></div>
        <div class="dm-sum-item rose"><span>বাকি</span><strong>${money(dueAmt)}</strong></div>
        <div class="dm-sum-item sky"><span>বিক্রয় সংখ্যা</span><strong>${list.length} টি</strong></div>
      </div>`;
      body.innerHTML=buildSaleDetailTable(list);
      break;
    }
    case "cashSales": {
      title.innerHTML=`<i class="fa-solid fa-money-bill-wave"></i> নগদ বিক্রয় বিস্তারিত (আজ)`;
      const list=sales.filter(s=>s.date===today&&(
        s.paymentMethod==="সম্পূর্ণ নগদ"||s.paymentMethod==="মোবাইল ব্যাংকিং"||
        s.paymentMethod==="নগদ+বাকি"||s.paymentMethod==="আংশিক"
      ));
      const cashTotal=list.reduce((s,x)=>
        s+(x.paymentMethod==="সম্পূর্ণ নগদ"||x.paymentMethod==="মোবাইল ব্যাংকিং"
          ?safeNum(x.total):safeNum(x.paidAmount||0)),0);
      summary.innerHTML=`<div class="dm-sum-grid">
        <div class="dm-sum-item green"><span>মোট নগদ প্রাপ্ত</span><strong>${money(cashTotal)}</strong></div>
        <div class="dm-sum-item sky"><span>লেনদেন সংখ্যা</span><strong>${list.length} টি</strong></div>
      </div>`;
      body.innerHTML=buildSaleDetailTable(list);
      break;
    }
    case "dueSales": {
      title.innerHTML=`<i class="fa-solid fa-clock"></i> বাকি বিক্রয় বিস্তারিত (আজ)`;
      const list=sales.filter(s=>s.date===today&&safeNum(s.dueAmount)>0);
      const dueTotal=list.reduce((s,x)=>s+safeNum(x.dueAmount||0),0);
      summary.innerHTML=`<div class="dm-sum-grid">
        <div class="dm-sum-item rose"><span>মোট বাকি</span><strong>${money(dueTotal)}</strong></div>
        <div class="dm-sum-item sky"><span>বাকি লেনদেন</span><strong>${list.length} টি</strong></div>
      </div>`;
      body.innerHTML=buildSaleDetailTable(list);
      break;
    }
    case "wholesale": {
      title.innerHTML=`<i class="fa-solid fa-store"></i> পাইকারি বিক্রয় বিস্তারিত (আজ)`;
      const list=sales.filter(s=>s.date===today&&s.saleType==="পাইকারি");
      const total=list.reduce((s,x)=>s+safeNum(x.total),0);
      const profit=list.reduce((s,x)=>s+safeNum(x.profit),0);
      summary.innerHTML=`<div class="dm-sum-grid">
        <div class="dm-sum-item sky"><span>পাইকারি বিক্রয়</span><strong>${money(total)}</strong></div>
        <div class="dm-sum-item green"><span>পাইকারি লাভ</span><strong>${money(profit)}</strong></div>
        <div class="dm-sum-item amber"><span>লেনদেন সংখ্যা</span><strong>${list.length} টি</strong></div>
      </div>`;
      body.innerHTML=buildSaleDetailTable(list);
      break;
    }
    case "retail": {
      title.innerHTML=`<i class="fa-solid fa-basket-shopping"></i> খুচরা বিক্রয় বিস্তারিত (আজ)`;
      const list=sales.filter(s=>s.date===today&&(s.saleType==="খুচরা"||!s.saleType));
      const total=list.reduce((s,x)=>s+safeNum(x.total),0);
      const profit=list.reduce((s,x)=>s+safeNum(x.profit),0);
      summary.innerHTML=`<div class="dm-sum-grid">
        <div class="dm-sum-item amber"><span>খুচরা বিক্রয়</span><strong>${money(total)}</strong></div>
        <div class="dm-sum-item green"><span>খুচরা লাভ</span><strong>${money(profit)}</strong></div>
        <div class="dm-sum-item sky"><span>লেনদেন সংখ্যা</span><strong>${list.length} টি</strong></div>
      </div>`;
      body.innerHTML=buildSaleDetailTable(list);
      break;
    }
    case "totalDue": {
      title.innerHTML=`<i class="fa-solid fa-file-invoice-dollar"></i> সকল বকেয়া বাকির বিস্তারিত`;
      const activeDues=dues.filter(d=>safeNum(d.dueAmount)>0);
      const totalDue=activeDues.reduce((s,d)=>s+safeNum(d.dueAmount),0);
      const overdueCount=activeDues.filter(d=>d.dueDate&&daysUntil(d.dueDate)<0).length;
      summary.innerHTML=`<div class="dm-sum-grid">
        <div class="dm-sum-item rose"><span>মোট বকেয়া</span><strong>${money(totalDue)}</strong></div>
        <div class="dm-sum-item sky"><span>বকেয়া গ্রাহক</span><strong>${activeDues.length} জন</strong></div>
        <div class="dm-sum-item amber"><span>মেয়াদ উত্তীর্ণ</span><strong>${overdueCount} জন</strong></div>
      </div>`;
      body.innerHTML=buildDueDetailTable(activeDues);
      break;
    }
    case "collection": {
      title.innerHTML=`<i class="fa-solid fa-hand-holding-dollar"></i> আজকের বাকি আদায় বিস্তারিত`;
      const rows=[];
      dues.forEach(d=>(d.payments||[]).forEach(p=>{
        if(p.date===today) rows.push({name:d.customerName,phone:d.phone,product:d.productName,amount:p.amount,time:p.createdAt||p.date});
      }));
      const total=rows.reduce((s,r)=>s+safeNum(r.amount),0);
      summary.innerHTML=`<div class="dm-sum-grid">
        <div class="dm-sum-item teal"><span>আজকের আদায়</span><strong>${money(total)}</strong></div>
        <div class="dm-sum-item sky"><span>আদায় সংখ্যা</span><strong>${rows.length} টি</strong></div>
      </div>`;
      body.innerHTML=buildCollectionDetailTable(rows);
      break;
    }
    case "mobile": {
      title.innerHTML=`<i class="fa-solid fa-mobile-screen"></i> মোবাইল ব্যাংকিং বিক্রয় (আজ)`;
      const list=sales.filter(s=>s.date===today&&s.paymentMethod==="মোবাইল ব্যাংকিং");
      const total=list.reduce((s,x)=>s+safeNum(x.total),0);
      summary.innerHTML=`<div class="dm-sum-grid">
        <div class="dm-sum-item sky"><span>মোবাইল ব্যাংকিং</span><strong>${money(total)}</strong></div>
        <div class="dm-sum-item amber"><span>লেনদেন সংখ্যা</span><strong>${list.length} টি</strong></div>
      </div>`;
      body.innerHTML=buildSaleDetailTable(list);
      break;
    }
    case "todayProfit": {
      title.innerHTML=`<i class="fa-solid fa-circle-dollar-to-slot"></i> আজকের লাভের বিস্তারিত`;
      const list=sales.filter(s=>s.date===today);
      const totalProfit=list.reduce((s,x)=>s+safeNum(x.profit),0);
      const wholsaleP=list.filter(s=>s.saleType==="পাইকারি").reduce((s,x)=>s+safeNum(x.profit),0);
      const retailP=list.filter(s=>s.saleType==="খুচরা"||!s.saleType).reduce((s,x)=>s+safeNum(x.profit),0);
      summary.innerHTML=`<div class="dm-sum-grid">
        <div class="dm-sum-item green"><span>মোট লাভ</span><strong>${money(totalProfit)}</strong></div>
        <div class="dm-sum-item sky"><span>পাইকারি লাভ</span><strong>${money(wholsaleP)}</strong></div>
        <div class="dm-sum-item amber"><span>খুচরা লাভ</span><strong>${money(retailP)}</strong></div>
      </div>`;
      body.innerHTML=buildSaleDetailTable(list, true);
      break;
    }
    case "partialSales": {
      title.innerHTML=`<i class="fa-solid fa-arrows-split-up-and-left"></i> আংশিক বিক্রিত পণ্যের বিস্তারিত`;
      const data=getPartialSoldData();
      const totalRevenue=data.reduce((s,d)=>s+d.totalRevenue,0);
      const totalTx=data.reduce((s,d)=>s+d.history.length,0);
      summary.innerHTML=`<div class="dm-sum-grid">
        <div class="dm-sum-item purple"><span>আংশিক বিক্রিত পণ্য</span><strong>${data.length}টি</strong></div>
        <div class="dm-sum-item green"><span>মোট রাজস্ব</span><strong>${money(totalRevenue)}</strong></div>
        <div class="dm-sum-item sky"><span>মোট লেনদেন</span><strong>${totalTx}টি</strong></div>
      </div>`;
      if(!data.length){
        body.innerHTML=`<div class="dm-empty"><i class="fa-solid fa-scale-balanced"></i><p>কোনো আংশিক (ওজনভিত্তিক) বিক্রয় পাওয়া যায়নি</p></div>`;
      } else {
        body.innerHTML=`<div class="partial-detail-list">${data.map(d=>{
          const prog=d.estimatedInitial>0?Math.min(100,(d.totalSold/d.estimatedInitial*100)).toFixed(0):0;
          return `<div class="partial-detail-card">
            <div class="pdc-header">
              <div class="pdc-name"><i class="fa-solid fa-scale-balanced"></i> ${safeText(d.name)} <span class="unit-tag">${d.unit}</span></div>
              <div class="pdc-stats">
                <span class="pdc-stat sky">স্টক: ${d.currentStock||0} ${d.unit}</span>
                <span class="pdc-stat green">বিক্রিত: ${d.totalSold} ${d.unit}</span>
                <span class="pdc-stat amber">রাজস্ব: ${money(d.totalRevenue)}</span>
              </div>
            </div>
            <div class="pdc-progress">
              <div style="height:8px;background:var(--surface-3);border-radius:4px;overflow:hidden">
                <div style="height:100%;width:${prog}%;background:linear-gradient(90deg,var(--accent),var(--accent-2));border-radius:4px;transition:width .5s"></div>
              </div>
              <div style="display:flex;justify-content:space-between;font-size:.72rem;color:var(--text-4);margin-top:4px">
                <span>বিক্রিত ${prog}%</span><span>অবশিষ্ট ${100-Number(prog)}%</span>
              </div>
            </div>
            <div class="dm-table-wrap" style="margin-top:10px"><table class="dm-table">
              <thead><tr><th>তারিখ</th><th>পরিমাণ</th><th>একক মূল্য</th><th>মোট</th><th>ক্রেতা</th></tr></thead>
              <tbody>${d.history.map(h=>`<tr>
                <td>${h.date}<br><small>${formatTime({createdAt:h.createdAt})}</small></td>
                <td style="font-weight:700">${h.qty} ${d.unit}</td>
                <td>${h.price?money(h.price)+"/"+d.unit:"-"}</td>
                <td style="font-weight:700;color:var(--brand)">${money(h.total)}</td>
                <td>${safeText(h.customer)}</td>
              </tr>`).join("")}</tbody>
            </table></div>
          </div>`;
        }).join("")}</div>`;
      }
      break;
    }
    case "weightSales": {
      title.innerHTML=`<i class="fa-solid fa-weight-hanging"></i> ওজনভিত্তিক পণ্যের বিস্তারিত`;
      const weightProds=products.filter(p=>p.mainCat==="ওজনভিত্তিক"||p.isWeightProduct);
      const soldMap2={};
      sales.forEach(s=>(s.items||[{productId:s.productId,quantity:s.quantity,isWeightSale:s.isWeightSale}]).forEach(item=>{
        if(soldMap2[item.productId]) soldMap2[item.productId]+=safeNum(item.quantity);
        else soldMap2[item.productId]=safeNum(item.quantity);
      }));
      const totalWeightStock=weightProds.reduce((s,p)=>s+safeNum(p.stock),0);
      summary.innerHTML=`<div class="dm-sum-grid">
        <div class="dm-sum-item purple"><span>মোট ওজনভিত্তিক পণ্য</span><strong>${weightProds.length}টি</strong></div>
        <div class="dm-sum-item green"><span>মোট অবশিষ্ট স্টক</span><strong>${totalWeightStock} ইউনিট</strong></div>
      </div>`;
      if(!weightProds.length){
        body.innerHTML=`<div class="dm-empty"><i class="fa-solid fa-weight-hanging"></i><p>কোনো ওজনভিত্তিক পণ্য পাওয়া যায়নি</p><small>পণ্য যোগ করার সময় "⚖️ ওজনভিত্তিক" ক্যাটাগরি বেছে নিন</small></div>`;
      } else {
        body.innerHTML=`<div class="dm-table-wrap"><table class="dm-table">
          <thead><tr><th>পণ্যের নাম</th><th>উপ-ক্যাটাগরি</th><th>একক</th><th>প্রাথমিক স্টক</th><th>মোট বিক্রিত</th><th>অবশিষ্ট</th><th>বিক্রয়মূল্য/একক</th></tr></thead>
          <tbody>${weightProds.map(p=>{
            const sold=soldMap2[p.id]||0;
            const est=safeNum(p.stock)+sold;
            const isLow=safeNum(p.stock)<=safeNum(p.lowStockLimit||5);
            return `<tr>
              <td><b>${safeText(p.name)}</b></td>
              <td>${safeText(p.subCat||"-")}</td>
              <td>${safeText(p.unit||"কেজি")}</td>
              <td>${est} ${p.unit||""}</td>
              <td style="color:var(--accent-2);font-weight:700">${sold} ${p.unit||""}</td>
              <td><span class="badge ${isLow?"red":"green"}">${p.stock} ${p.unit||""}</span></td>
              <td style="font-weight:700">${money(p.sellingPrice)}</td>
            </tr>`;
          }).join("")}</tbody>
        </table></div>`;
      }
      break;
    }
    default: return;
  }

  modal.style.display="flex";
  document.body.style.overflow="hidden";
}

function buildSaleDetailTable(list, showProfit=false){
  if(!list.length) return `<div class="dm-empty"><i class="fa-solid fa-inbox"></i><p>কোনো তথ্য পাওয়া যায়নি</p></div>`;
  return `<div class="dm-table-wrap"><table class="dm-table">
    <thead><tr>
      <th>সময়</th><th>পণ্য</th><th>ক্রেতা</th>
      <th>পরিমাণ</th><th>মোট</th>
      ${showProfit?'<th>লাভ</th>':''}
      <th>পেমেন্ট</th><th>ধরন</th>
    </tr></thead>
    <tbody>${list.map(s=>{
      const pmClass=s.paymentMethod==="সম্পূর্ণ নগদ"?"cash"
        :s.paymentMethod==="মোবাইল ব্যাংকিং"?"mobile"
        :s.paymentMethod==="সম্পূর্ণ বাকি"||safeNum(s.dueAmount)>0?"due":"cash";
      return `<tr>
        <td style="white-space:nowrap">${s.date}<br><small style="color:var(--text-4)">${formatTime(s)}</small></td>
        <td><b>${safeText(s.productName)}</b></td>
        <td>${s.customerName?safeText(s.customerName):'-'}${s.village?`<br><small>${safeText(s.village)}</small>`:''}</td>
        <td style="text-align:center">${s.quantity}</td>
        <td style="text-align:right;font-weight:700;color:var(--brand)">${money(s.total)}</td>
        ${showProfit?`<td style="text-align:right;color:var(--accent-2);font-weight:700">${money(s.profit)}</td>`:''}
        <td><span class="payment-badge-sm ${pmClass}">${safeText(s.paymentMethod||'-')}</span>
          ${safeNum(s.dueAmount)>0?`<br><small style="color:var(--rose-mid)">বাকি: ${money(s.dueAmount)}</small>`:''}</td>
        <td><span class="badge ${s.saleType==='পাইকারি'?'blue':'green'}">${s.saleType||'খুচরা'}</span></td>
      </tr>`;
    }).join('')}</tbody>
  </table></div>`;
}

function buildDueDetailTable(list){
  if(!list.length) return `<div class="dm-empty"><i class="fa-solid fa-circle-check" style="color:var(--green-bright)"></i><p>কোনো বকেয়া নেই</p></div>`;
  return `<div class="dm-table-wrap"><table class="dm-table">
    <thead><tr><th>ক্রেতা</th><th>পণ্য</th><th>মোট পরিমাণ</th><th>পরিশোধিত</th><th>বকেয়া</th><th>তারিখ</th></tr></thead>
    <tbody>${list.map(d=>{
      const days=d.dueDate?daysUntil(d.dueDate):null;
      const isOverdue=days!==null&&days<0;
      return `<tr>
        <td><b>${safeText(d.customerName)}</b>${d.phone?`<br><small>${safeText(d.phone)}</small>`:''}</td>
        <td>${safeText(d.productName||'-')}</td>
        <td style="text-align:right">${money(d.totalAmount)}</td>
        <td style="text-align:right;color:var(--green-dark)">${money(d.paidAmount)}</td>
        <td style="text-align:right;font-weight:700;color:${isOverdue?'var(--rose-mid)':'var(--soil-mid)'}"> ${money(d.dueAmount)}</td>
        <td>${d.dueDate||d.date||'-'}${isOverdue?`<br><span style="font-size:.7rem;color:var(--rose-mid)">⚠️ ${Math.abs(days)} দিন পেরিয়েছে</span>`:''}</td>
      </tr>`;
    }).join('')}</tbody>
  </table></div>`;
}

function buildCollectionDetailTable(rows){
  if(!rows.length) return `<div class="dm-empty"><i class="fa-solid fa-inbox"></i><p>আজ কোনো আদায় হয়নি</p></div>`;
  return `<div class="dm-table-wrap"><table class="dm-table">
    <thead><tr><th>ক্রেতা</th><th>পণ্য</th><th>আদায়কৃত</th><th>সময়</th></tr></thead>
    <tbody>${rows.map(r=>`<tr>
      <td><b>${safeText(r.name)}</b>${r.phone?`<br><small>${safeText(r.phone)}</small>`:''}</td>
      <td>${safeText(r.product||'-')}</td>
      <td style="text-align:right;font-weight:700;color:var(--green-dark)">${money(r.amount)}</td>
      <td>${formatTime({createdAt:r.time})}</td>
    </tr>`).join('')}</tbody>
  </table></div>`;
}

function closeDetailModal(){
  const modal=$("detailModal");
  if(modal){ modal.style.display="none"; document.body.style.overflow=""; }
}
window.showCardDetail=showCardDetail;
window.closeDetailModal=closeDetailModal;

document.addEventListener("click",e=>{
  if(e.target.id==="detailModal") closeDetailModal();
});

/* ===================== Pagination State ===================== */
let salesPageSize = 50;
let salesPageOffset = 0;

/* ===================== Render All ===================== */
function renderAll(){
  renderProducts();
  renderSales();
  renderDues();
  renderDashboard();
  renderReportCards();
  buildNotifications();
  renderWithdrawBalance();
  updateSalesStatsBar();
  renderBackupStats();
}

function renderBackupStats(){
  const el=$("backupStats"); if(!el) return;
  el.innerHTML=`
    <div class="bstat-grid">
      <div class="bstat-item"><i class="fa-solid fa-seedling"></i><span>পণ্য</span><strong>${products.length}টি</strong></div>
      <div class="bstat-item"><i class="fa-solid fa-receipt"></i><span>বিক্রয়</span><strong>${sales.length}টি</strong></div>
      <div class="bstat-item"><i class="fa-solid fa-hand-holding-dollar"></i><span>বাকি</span><strong>${dues.length}টি</strong></div>
      <div class="bstat-item"><i class="fa-solid fa-arrow-up-from-bracket"></i><span>উত্তোলন</span><strong>${withdrawals.length}টি</strong></div>
    </div>`;
}

/* Section-specific renders (দ্রুততার জন্য) */
function renderSalesOnly(){
  renderSales();
  renderDashboard();
  updateSalesStatsBar();
  buildNotifications();
}
function renderDuesOnly(){
  renderDues();
  renderDashboard();
  buildNotifications();
}
function renderProductsOnly(){
  renderProducts();
  renderDashboard();
  buildNotifications();
}

/* ===================== Unit Change Helper ===================== */
function onUnitChange(){
  const unit=($("pUnit")?.value||"").toLowerCase();
  const weightUnits=["কেজি","kg","গ্রাম","gram","g","লিটার","litre","liter","l","মিলিলিটার","ml"];
  const isWeight=weightUnits.some(u=>unit.includes(u));
  const hint=$("weightStockHint"), hintText=$("weightStockHintText");
  if(hint) hint.style.display=isWeight?"":"none";
  if(hintText&&isWeight){
    const u=($("pUnit")?.value)||"ইউনিট";
    hintText.textContent=`স্টক ${u}তে দিন — বিক্রয়ের সময় যেকোনো পরিমাণে কেটে যাবে`;
  }
}
window.onUnitChange=onUnitChange;

/* ===================== Partial Sold Report ===================== */
function getPartialSoldData(){
  /* Build per-product sold history from weight sales */
  const map={};
  sales.forEach(s=>{
    const items=s.items||[{productId:s.productId,productName:s.productName,quantity:s.quantity,total:s.total,isWeightSale:s.isWeightSale||false}];
    items.forEach(item=>{
      if(!item.isWeightSale) return;
      const pid=item.productId;
      const prod=products.find(p=>p.id===pid)||{name:item.productName,unit:"",stock:0};
      if(!map[pid]){
        map[pid]={
          productId:pid,
          name:prod.name||item.productName,
          unit:prod.unit||"",
          initialStock: safeNum(prod.stock), // current stock
          totalSold:0,
          totalRevenue:0,
          history:[]
        };
      }
      map[pid].totalSold+=safeNum(item.quantity);
      map[pid].totalRevenue+=safeNum(item.total);
      map[pid].history.push({
        date:s.date,
        createdAt:s.createdAt||s.date,
        qty:safeNum(item.quantity),
        price:safeNum(item.price||0),
        total:safeNum(item.total),
        customer:s.customerName||"সাধারণ ক্রেতা",
        saleId:s.id
      });
    });
  });

  // Enrich with current product data
  Object.keys(map).forEach(pid=>{
    const prod=products.find(p=>p.id===pid);
    if(prod){
      map[pid].name=prod.name;
      map[pid].unit=prod.unit||"";
      map[pid].currentStock=safeNum(prod.stock);
      // estimated initial = current + totalSold
      map[pid].estimatedInitial=safeNum(prod.stock)+map[pid].totalSold;
    }
    map[pid].history.sort((a,b)=>(b.createdAt||b.date||"").localeCompare(a.createdAt||a.date||""));
  });
  return Object.values(map);
}

function openPartialSoldReport(){
  const panel=$("partialSoldPanel"); if(!panel) return;
  renderPartialSoldReport();
  panel.style.display="flex";
  document.body.style.overflow="hidden";
}
window.openPartialSoldReport=openPartialSoldReport;

function closePartialSoldReport(){
  const panel=$("partialSoldPanel"); if(panel){ panel.style.display="none"; document.body.style.overflow=""; }
}
window.closePartialSoldReport=closePartialSoldReport;

function renderPartialSoldReport(){
  const data=getPartialSoldData();
  const summary=$("partialReportSummary"), body=$("partialReportBody");
  if(!summary||!body) return;

  const totalPartialSales=data.reduce((s,d)=>s+d.totalRevenue,0);
  const totalPartialSold=data.length;
  const totalTransactions=data.reduce((s,d)=>s+d.history.length,0);

  summary.innerHTML=`
    <div class="pr-summary-grid">
      <div class="pr-sum-card purple">
        <i class="fa-solid fa-arrows-split-up-and-left"></i>
        <div><span>আংশিক বিক্রিত পণ্য</span><strong>${totalPartialSold}টি</strong></div>
      </div>
      <div class="pr-sum-card green">
        <i class="fa-solid fa-sack-dollar"></i>
        <div><span>মোট আংশিক রাজস্ব</span><strong>${money(totalPartialSales)}</strong></div>
      </div>
      <div class="pr-sum-card sky">
        <i class="fa-solid fa-receipt"></i>
        <div><span>মোট লেনদেন সংখ্যা</span><strong>${totalTransactions}টি</strong></div>
      </div>
    </div>`;

  if(!data.length){
    body.innerHTML=`<div class="pr-empty"><i class="fa-solid fa-scale-balanced"></i><p>কোনো আংশিক (ওজনভিত্তিক) বিক্রয় পাওয়া যায়নি</p><small>বিক্রয় সেকশনে ⚖️ বোতাম চেপে আংশিক/ওজনভিত্তিক বিক্রয় করুন</small></div>`;
    return;
  }

  body.innerHTML=data.map((d,idx)=>{
    const prog=d.estimatedInitial>0?Math.min(100,(d.totalSold/d.estimatedInitial*100)).toFixed(0):0;
    const histRows=d.history.map(h=>`
      <tr>
        <td>${h.date}<br><small style="color:var(--text-4)">${formatTime({createdAt:h.createdAt})}</small></td>
        <td style="font-weight:600">${h.qty} ${d.unit}</td>
        <td>${h.price?money(h.price)+'/'+d.unit:'-'}</td>
        <td style="font-weight:700;color:var(--brand)">${money(h.total)}</td>
        <td>${safeText(h.customer)}</td>
      </tr>`).join("");
    return `
    <div class="pr-product-card">
      <div class="pr-product-header">
        <div class="pr-product-name">
          <i class="fa-solid fa-scale-balanced"></i>
          ${safeText(d.name)}
          <span class="pr-unit-badge">${d.unit||"ইউনিট"}</span>
        </div>
        <div class="pr-product-stats">
          <span class="pr-stat sky"><i class="fa-solid fa-boxes-stacked"></i> বর্তমান স্টক: <b>${d.currentStock||0} ${d.unit}</b></span>
          <span class="pr-stat green"><i class="fa-solid fa-cart-shopping"></i> মোট বিক্রিত: <b>${d.totalSold} ${d.unit}</b></span>
          <span class="pr-stat amber"><i class="fa-solid fa-box-open"></i> প্রাথমিক স্টক (আনুমানিক): <b>${d.estimatedInitial||0} ${d.unit}</b></span>
        </div>
      </div>

      <!-- Progress bar -->
      <div class="pr-progress-wrap">
        <div class="pr-progress-labels">
          <span>বিক্রিত ${prog}%</span>
          <span>অবশিষ্ট ${100-Number(prog)}%</span>
        </div>
        <div class="pr-progress-track">
          <div class="pr-progress-fill" style="width:${prog}%"></div>
        </div>
        <div class="pr-progress-detail">
          <div class="pr-pd-item green"><span>মোট স্টক (আনুমানিক)</span><strong>${d.estimatedInitial||0} ${d.unit}</strong></div>
          <div class="pr-pd-item rose"><span>মোট বিক্রিত</span><strong>${d.totalSold} ${d.unit}</strong></div>
          <div class="pr-pd-item sky"><span>অবশিষ্ট</span><strong>${d.currentStock||0} ${d.unit}</strong></div>
          <div class="pr-pd-item amber"><span>মোট রাজস্ব</span><strong>${money(d.totalRevenue)}</strong></div>
        </div>
      </div>

      <!-- History table -->
      <div class="pr-hist-title"><i class="fa-solid fa-clock-rotate-left"></i> বিক্রয় ইতিহাস (${d.history.length}টি লেনদেন)</div>
      <div class="pr-hist-wrap">
        <table class="pr-hist-table">
          <thead><tr><th>তারিখ ও সময়</th><th>পরিমাণ</th><th>একক মূল্য</th><th>মোট</th><th>ক্রেতা</th></tr></thead>
          <tbody>${histRows}</tbody>
        </table>
      </div>
    </div>`;
  }).join("");
}

function updatePartialSoldDashboard(){
  const data=getPartialSoldData();
  const totalRevenue=data.reduce((s,d)=>s+d.totalRevenue,0);
  const totalRemainingStock=data.reduce((s,d)=>s+(d.currentStock||0),0);
  if($("partialSoldCount")) $("partialSoldCount").textContent=data.length;
  if($("partialSoldTotal")) $("partialSoldTotal").textContent=money(totalRevenue);
  if($("partialRemainingStock")) $("partialRemainingStock").textContent=totalRemainingStock+" ইউনিট";
  if($("partialSaleCountLabel")) $("partialSaleCountLabel").textContent=`${data.length}টি পণ্য বিক্রিত`;
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

/* ===================== Auto Product Input — Init ===================== */
function initAutoProductInput(){
  const parseBtn=$("autoParseBtn"), fillBtn=$("autoFillBtn"), area=$("autoPasteArea");
  const resultEl=$("autoParseResult"), errEl=$("autoParseError");
  if(!parseBtn||!area||!resultEl||!errEl) return;

  parseBtn.addEventListener("click",()=>{
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
    $("productForm").dispatchEvent(new Event("submit",{cancelable:true,bubbles:true}));
    if(area) area.value="";
    resultEl.classList.remove("show");
    fillBtn.style.display="none";
    autoParsedProduct=null;
  });
}

/* ═══════════════════════════════════════════════════════════
   সব (All) — Central View System
   All View Panel: Sales, Product Store, Dues
   Dashboard Card → Popup → Click → All View Deep Dive
═══════════════════════════════════════════════════════════ */

let allViewActiveTab = "sales";
let allViewSearchTerm = "";
let allViewDateFilter = "all";
let allViewCatFilter  = "all";
let allViewPayFilter  = "all";
let allViewDueFilter  = "all";

/* ---- Open/Close ---- */
function openAllView(tab, itemId){
  const panel = $("allViewPanel");
  if(!panel) return;
  panel.style.display = "flex";
  document.body.style.overflow = "hidden";
  switchAllTab(tab || allViewActiveTab);
  if(itemId) setTimeout(()=>openAllViewDetail(tab, itemId), 80);
}

function closeAllView(){
  const panel = $("allViewPanel");
  if(panel){ panel.style.display = "none"; document.body.style.overflow = ""; }
  hideAllViewDetail();
}

function initAllView(){
  const closeBtn = $("closeAllView");
  if(closeBtn) closeBtn.addEventListener("click", closeAllView);

  const overlay = $("allViewPanel");
  if(overlay) overlay.addEventListener("click", e => { if(e.target === overlay) closeAllView(); });

  /* All View button in topbar */
  const allBtn = $("allViewBtn");
  if(allBtn) allBtn.addEventListener("click", ()=>openAllView("sales"));

  /* Tab buttons */
  document.querySelectorAll(".avt").forEach(btn=>{
    btn.addEventListener("click",()=>switchAllTab(btn.dataset.avt));
  });

  /* Search */
  const srch = $("allViewSearch");
  if(srch) srch.addEventListener("input", e=>{
    allViewSearchTerm = e.target.value.toLowerCase();
    renderAllViewActiveTab();
  });

  /* Date filter */
  const df = $("allViewDateFilter");
  if(df) df.addEventListener("change", e=>{
    allViewDateFilter = e.target.value;
    renderAllViewActiveTab();
  });

  /* Category filter (products) */
  const cf = $("allViewCatFilter");
  if(cf) cf.addEventListener("change", e=>{
    allViewCatFilter = e.target.value;
    renderAllViewActiveTab();
  });

  /* Payment filter (sales) */
  const pf = $("allViewPayFilter");
  if(pf) pf.addEventListener("change", e=>{
    allViewPayFilter = e.target.value;
    renderAllViewActiveTab();
  });

  /* Due filter */
  const duf = $("allViewDueFilter");
  if(duf) duf.addEventListener("change", e=>{
    allViewDueFilter = e.target.value;
    renderAllViewActiveTab();
  });

  /* Print */
  const printBtn = $("allViewPrint");
  if(printBtn) printBtn.addEventListener("click", ()=>window.print());

  /* Export */
  const exportBtn = $("allViewExport");
  if(exportBtn) exportBtn.addEventListener("click", exportAllViewCSV);

  /* Back button in detail view */
  const backBtn = $("avBackBtn");
  if(backBtn) backBtn.addEventListener("click", hideAllViewDetail);
}

function switchAllTab(tab){
  allViewActiveTab = tab;
  document.querySelectorAll(".avt").forEach(b=>b.classList.toggle("active", b.dataset.avt===tab));
  document.querySelectorAll(".avt-pane").forEach(p=>p.classList.remove("active"));
  const pane = $("avp-"+tab);
  if(pane) pane.classList.add("active");

  /* Show/hide filters based on tab */
  const catF = $("allViewCatFilter");
  const payF = $("allViewPayFilter");
  const dueF = $("allViewDueFilter");
  if(catF) catF.style.display = tab==="products"?"":"none";
  if(payF) payF.style.display = tab==="sales"?"":"none";
  if(dueF) dueF.style.display = tab==="dues"?"":"none";

  /* Reset search */
  const srch = $("allViewSearch");
  if(srch){ srch.value=""; allViewSearchTerm=""; }

  hideAllViewDetail();
  renderAllViewActiveTab();
}

function renderAllViewActiveTab(){
  if(allViewActiveTab==="sales")    renderAllViewSales();
  if(allViewActiveTab==="products") renderAllViewProducts();
  if(allViewActiveTab==="dues")     renderAllViewDues();
}

/* ---- Date filter helper ---- */
function allViewDateMatch(dateStr){
  if(allViewDateFilter==="all") return true;
  if(!dateStr) return false;
  const today = todayISO();
  if(allViewDateFilter==="today") return dateStr===today;
  const d = new Date(dateStr);
  if(allViewDateFilter==="week"){
    const now = new Date(); const dow = now.getDay();
    const start = new Date(now); start.setDate(now.getDate()-dow);
    start.setHours(0,0,0,0);
    return d >= start;
  }
  if(allViewDateFilter==="month"){
    return dateStr.slice(0,7) === today.slice(0,7);
  }
  return true;
}

/* ══════════ SALES TAB ══════════ */
function renderAllViewSales(){
  const summaryEl = $("avSalesSummary");
  const tableEl   = $("avSalesTable");
  if(!summaryEl||!tableEl) return;

  /* Filter */
  let list = sales.filter(s=>{
    const dateOk = allViewDateMatch(s.date);
    const searchOk = !allViewSearchTerm ||
      (s.productName||"").toLowerCase().includes(allViewSearchTerm) ||
      (s.customerName||"").toLowerCase().includes(allViewSearchTerm) ||
      (s.village||"").toLowerCase().includes(allViewSearchTerm) ||
      (s.id||"").toLowerCase().includes(allViewSearchTerm);
    const payOk = allViewPayFilter==="all" || s.paymentMethod===allViewPayFilter;
    return dateOk && searchOk && payOk;
  });

  /* Summary */
  const totalSales   = list.reduce((s,x)=>s+safeNum(x.total),0);
  const totalProfit  = list.reduce((s,x)=>s+safeNum(x.profit),0);
  const totalCash    = list.filter(s=>s.paymentMethod==="সম্পূর্ণ নগদ"||s.paymentMethod==="মোবাইল ব্যাংকিং")
                           .reduce((s,x)=>s+safeNum(x.total),0)
                     + list.filter(s=>s.paymentMethod==="নগদ+বাকি"||s.paymentMethod==="আংশিক")
                           .reduce((s,x)=>s+safeNum(x.paidAmount||0),0);
  const totalDue     = list.reduce((s,x)=>s+safeNum(x.dueAmount||0),0);
  const wholesale    = list.filter(s=>s.saleType==="পাইকারি").reduce((s,x)=>s+safeNum(x.total),0);
  const retail       = list.filter(s=>s.saleType!=="পাইকারি").reduce((s,x)=>s+safeNum(x.total),0);

  summaryEl.innerHTML = `
    <div class="avp-sum-card green"><div class="avp-sum-label">মোট বিক্রয়</div><div class="avp-sum-value">${money(totalSales)}</div><div class="avp-sum-sub">${list.length}টি লেনদেন</div></div>
    <div class="avp-sum-card teal"><div class="avp-sum-label">নগদ প্রাপ্ত</div><div class="avp-sum-value">${money(totalCash)}</div><div class="avp-sum-sub">সরাসরি</div></div>
    <div class="avp-sum-card rose"><div class="avp-sum-label">মোট বাকি</div><div class="avp-sum-value">${money(totalDue)}</div><div class="avp-sum-sub">বকেয়া</div></div>
    <div class="avp-sum-card green"><div class="avp-sum-label">মোট লাভ</div><div class="avp-sum-value">${money(totalProfit)}</div><div class="avp-sum-sub">নিট মুনাফা</div></div>
    <div class="avp-sum-card sky"><div class="avp-sum-label">পাইকারি</div><div class="avp-sum-value">${money(wholesale)}</div><div class="avp-sum-sub">পাইকারি বিক্রয়</div></div>
    <div class="avp-sum-card amber"><div class="avp-sum-label">খুচরা</div><div class="avp-sum-value">${money(retail)}</div><div class="avp-sum-sub">খুচরা বিক্রয়</div></div>
  `;

  /* Table */
  if(!list.length){
    tableEl.innerHTML = `<div class="avp-empty"><i class="fa-solid fa-inbox"></i><p>কোনো বিক্রয় তথ্য পাওয়া যায়নি</p></div>`;
    return;
  }

  tableEl.innerHTML = `
    <div class="avp-table-head">
      <h4><i class="fa-solid fa-list-ul"></i> সকল বিক্রয় তালিকা</h4>
      <span class="avp-count-badge">${list.length} টি রেকর্ড</span>
    </div>
    <div class="avp-table-overflow">
      <table class="avp-table">
        <thead><tr>
          <th>তারিখ/সময়</th>
          <th>পণ্য</th>
          <th>ক্রেতা</th>
          <th>পরিমাণ</th>
          <th>মোট মূল্য</th>
          <th>প্রাপ্ত</th>
          <th>বাকি</th>
          <th>লাভ</th>
          <th>পেমেন্ট</th>
          <th>ধরন</th>
        </tr></thead>
        <tbody>
          ${list.map(s=>{
            const pmClass = s.paymentMethod==="সম্পূর্ণ নগদ"?"cash":s.paymentMethod==="মোবাইল ব্যাংকিং"?"mobile":safeNum(s.dueAmount)>0?"due":"cash";
            const items = s.items||[{productName:s.productName,quantity:s.quantity}];
            const productNames = items.map(i=>safeText(i.productName||"-")).join(", ");
            const totalQty = items.reduce((t,i)=>t+safeNum(i.quantity),0);
            return `<tr class="avp-clickable-row" onclick="openAllViewDetail('sales','${s.id}')">
              <td style="white-space:nowrap">${s.date}<br><small style="color:var(--text-4)">${formatTime(s)}</small></td>
              <td><b>${productNames}</b>${items.length>1?`<br><small style="color:var(--text-4)">${items.length}টি পণ্য</small>`:""}</td>
              <td>${s.customerName?safeText(s.customerName):"-"}${s.village?`<br><small style="color:var(--text-4)">${safeText(s.village)}</small>`:""}</td>
              <td style="text-align:center">${totalQty}</td>
              <td style="text-align:right;font-weight:800;color:var(--brand)">${money(s.total)}</td>
              <td style="text-align:right;color:var(--accent-2);font-weight:700">${money(safeNum(s.paidAmount)||safeNum(s.total))}</td>
              <td style="text-align:right;color:var(--rose-2);font-weight:700">${safeNum(s.dueAmount)>0?money(s.dueAmount):"-"}</td>
              <td style="text-align:right;color:var(--accent);font-weight:700">${money(s.profit)}</td>
              <td><span class="payment-badge-sm ${pmClass}">${safeText(s.paymentMethod||"-")}</span></td>
              <td><span class="badge ${s.saleType==="পাইকারি"?"blue":"green"}">${s.saleType||"খুচরা"}</span></td>
            </tr>`;
          }).join("")}
        </tbody>
      </table>
    </div>
  `;
}

/* ══════════ PRODUCTS TAB ══════════ */
function renderAllViewProducts(){
  const dashEl  = $("avStockDashboard");
  const tableEl = $("avProductsTable");
  if(!dashEl||!tableEl) return;

  /* Filter */
  let list = products.filter(p=>{
    const catOk = allViewCatFilter==="all"||p.mainCat===allViewCatFilter;
    const searchOk = !allViewSearchTerm ||
      (p.name||"").toLowerCase().includes(allViewSearchTerm) ||
      (p.brand||"").toLowerCase().includes(allViewSearchTerm) ||
      (p.subCat||"").toLowerCase().includes(allViewSearchTerm) ||
      (p.variety||"").toLowerCase().includes(allViewSearchTerm);
    return catOk && searchOk;
  });

  /* Stock analytics */
  const totalStockCost   = list.reduce((s,p)=>s+safeNum(p.stock)*safeNum(p.purchasePrice),0);
  const totalStockSell   = list.reduce((s,p)=>s+safeNum(p.stock)*safeNum(p.sellingPrice),0);
  const totalPossProfit  = totalStockSell - totalStockCost;
  const lowStockItems    = list.filter(p=>safeNum(p.stock)<=safeNum(p.lowStockLimit||5));

  /* Sort for top/bottom */
  const byValue = [...list].sort((a,b)=>
    (safeNum(b.stock)*safeNum(b.purchasePrice))-(safeNum(a.stock)*safeNum(a.purchasePrice)));
  const topProduct    = byValue[0];
  const bottomProduct = byValue[byValue.length-1];

  /* Sold qty map */
  const soldMap = {};
  sales.forEach(s=>{
    (s.items||[{productId:s.productId,quantity:s.quantity}]).forEach(item=>{
      soldMap[item.productId]=(soldMap[item.productId]||0)+safeNum(item.quantity);
    });
  });

  dashEl.innerHTML = `
    <div class="avp-svd-title"><i class="fa-solid fa-chart-pie"></i> স্টক মূল্য বিশ্লেষণ — Total Stock Value Dashboard</div>
    <div class="avp-svd-grid">
      <div class="avp-svd-item"><div class="avp-svd-lbl">মোট পণ্য সংখ্যা</div><div class="avp-svd-val">${list.length}টি</div></div>
      <div class="avp-svd-item"><div class="avp-svd-lbl">মোট স্টক (ক্রয়) মূল্য</div><div class="avp-svd-val" style="color:var(--rose-2)">${money(totalStockCost)}</div></div>
      <div class="avp-svd-item"><div class="avp-svd-lbl">মোট স্টক (বিক্রয়) মূল্য</div><div class="avp-svd-val" style="color:var(--brand)">${money(totalStockSell)}</div></div>
      <div class="avp-svd-item"><div class="avp-svd-lbl">সম্ভাব্য মোট লাভ</div><div class="avp-svd-val" style="color:var(--accent-2)">${money(totalPossProfit)}</div></div>
      <div class="avp-svd-item"><div class="avp-svd-lbl">কম স্টক পণ্য</div><div class="avp-svd-val" style="color:var(--rose)">${lowStockItems.length}টি</div></div>
      <div class="avp-svd-item"><div class="avp-svd-lbl">বীজ পণ্য</div><div class="avp-svd-val">${list.filter(p=>p.mainCat==="বীজ").length}টি</div></div>
      <div class="avp-svd-item"><div class="avp-svd-lbl">কীটনাশক পণ্য</div><div class="avp-svd-val">${list.filter(p=>p.mainCat==="কীটনাশক").length}টি</div></div>
    </div>
    ${topProduct||bottomProduct?`
    <div class="avp-svd-top">
      ${topProduct?`<div class="avp-top-product-card">
        <div class="icon high"><i class="fa-solid fa-trophy"></i></div>
        <div>
          <div class="label">সর্বোচ্চ মূল্যমানের পণ্য</div>
          <div class="value">${safeText(topProduct.name)}</div>
          <div class="label" style="margin-top:2px">${money(safeNum(topProduct.stock)*safeNum(topProduct.purchasePrice))}</div>
        </div>
      </div>`:""}
      ${bottomProduct&&bottomProduct!==topProduct?`<div class="avp-top-product-card">
        <div class="icon low"><i class="fa-solid fa-arrow-trend-down"></i></div>
        <div>
          <div class="label">সর্বনিম্ন মূল্যমানের পণ্য</div>
          <div class="value">${safeText(bottomProduct.name)}</div>
          <div class="label" style="margin-top:2px">${money(safeNum(bottomProduct.stock)*safeNum(bottomProduct.purchasePrice))}</div>
        </div>
      </div>`:""}
    </div>`:""}
  `;

  if(!list.length){
    tableEl.innerHTML = `<div class="avp-empty"><i class="fa-solid fa-seedling"></i><p>কোনো পণ্য পাওয়া যায়নি</p></div>`;
    return;
  }

  tableEl.innerHTML = `
    <div class="avp-table-head">
      <h4><i class="fa-solid fa-seedling"></i> সকল প্রোডাক্ট তালিকা</h4>
      <span class="avp-count-badge">${list.length} টি পণ্য</span>
    </div>
    <div class="avp-table-overflow">
      <table class="avp-table">
        <thead><tr>
          <th>পণ্যের নাম</th>
          <th>ক্যাটাগরি</th>
          <th>ইউনিট</th>
          <th>বর্তমান স্টক</th>
          <th>ক্রয়মূল্য</th>
          <th>বিক্রয়মূল্য</th>
          <th>স্টক (ক্রয়) মূল্য</th>
          <th>স্টক (বিক্রয়) মূল্য</th>
          <th>সম্ভাব্য লাভ</th>
          <th>মোট বিক্রীত</th>
          <th>স্ট্যাটাস</th>
        </tr></thead>
        <tbody>
          ${list.map(p=>{
            const stockCostVal  = safeNum(p.stock)*safeNum(p.purchasePrice);
            const stockSellVal  = safeNum(p.stock)*safeNum(p.sellingPrice);
            const possProfit    = stockSellVal - stockCostVal;
            const isLow = safeNum(p.stock)<=safeNum(p.lowStockLimit||5);
            const isSeed = p.mainCat==="বীজ";
            const soldQty = soldMap[p.id]||0;
            return `<tr class="avp-clickable-row" onclick="openAllViewDetail('products','${p.id}')">
              <td><b>${safeText(p.name)}</b>${p.variety?`<br><small style="color:var(--text-4)">${safeText(p.variety)}</small>`:""}${p.packSize?`<span class="variety-badge">${safeText(p.packSize)}</span>`:""}</td>
              <td><span class="product-type-badge ${isSeed?"seed":"pest"}">${isSeed?"🌱 বীজ":"🧪 কীটনাশক"}</span>${p.subCat?`<br><small>${safeText(p.subCat)}</small>`:""}</td>
              <td>${safeText(p.unit||"প্যাকেট")}</td>
              <td class="${isLow?"avp-stock-low":"avp-stock-ok"}">${p.stock} ${p.unit||""}</td>
              <td style="text-align:right">${money(p.purchasePrice)}</td>
              <td style="text-align:right">${money(p.sellingPrice)}</td>
              <td style="text-align:right;font-weight:700;color:var(--rose-2)">${money(stockCostVal)}</td>
              <td style="text-align:right;font-weight:700;color:var(--brand)">${money(stockSellVal)}</td>
              <td style="text-align:right;font-weight:700;color:var(--accent-2)">${money(possProfit)}</td>
              <td style="text-align:center">${soldQty} ${p.unit||""}</td>
              <td><span class="badge ${isLow?"red":"green"}">${isLow?"কম স্টক":"পর্যাপ্ত"}</span></td>
            </tr>`;
          }).join("")}
        </tbody>
      </table>
    </div>
  `;
}

/* ══════════ DUES TAB ══════════ */
function renderAllViewDues(){
  const summaryEl = $("avDuesSummary");
  const tableEl   = $("avDuesTable");
  if(!summaryEl||!tableEl) return;

  let list = dues.filter(d=>{
    const dateOk  = allViewDateMatch(d.date);
    const searchOk = !allViewSearchTerm ||
      (d.customerName||"").toLowerCase().includes(allViewSearchTerm) ||
      (d.productName||"").toLowerCase().includes(allViewSearchTerm) ||
      (d.phone||"").toLowerCase().includes(allViewSearchTerm);
    let dueOk = true;
    if(allViewDueFilter==="active")  dueOk = safeNum(d.dueAmount)>0;
    if(allViewDueFilter==="overdue") dueOk = safeNum(d.dueAmount)>0&&d.dueDate&&daysUntil(d.dueDate)<0;
    if(allViewDueFilter==="paid")    dueOk = safeNum(d.dueAmount)<=0;
    return dateOk && searchOk && dueOk;
  });

  const totalDue     = list.reduce((s,d)=>s+safeNum(d.dueAmount),0);
  const totalPaid    = list.reduce((s,d)=>s+safeNum(d.paidAmount||0),0);
  const totalAmount  = list.reduce((s,d)=>s+safeNum(d.totalAmount||d.total||0),0);
  const overdueList  = list.filter(d=>d.dueDate&&daysUntil(d.dueDate)<0&&safeNum(d.dueAmount)>0);
  const overdueAmt   = overdueList.reduce((s,d)=>s+safeNum(d.dueAmount),0);
  const activeDues   = list.filter(d=>safeNum(d.dueAmount)>0).length;

  summaryEl.innerHTML = `
    <div class="avp-sum-card rose"><div class="avp-sum-label">মোট বকেয়া</div><div class="avp-sum-value">${money(totalDue)}</div><div class="avp-sum-sub">${activeDues} জন গ্রাহক</div></div>
    <div class="avp-sum-card green"><div class="avp-sum-label">মোট পরিশোধ</div><div class="avp-sum-value">${money(totalPaid)}</div><div class="avp-sum-sub">আদায়কৃত</div></div>
    <div class="avp-sum-card sky"><div class="avp-sum-label">মোট ধার</div><div class="avp-sum-value">${money(totalAmount)}</div><div class="avp-sum-sub">মূল পরিমাণ</div></div>
    <div class="avp-sum-card amber"><div class="avp-sum-label">মেয়াদ উত্তীর্ণ</div><div class="avp-sum-value">${money(overdueAmt)}</div><div class="avp-sum-sub">${overdueList.length} জন</div></div>
    <div class="avp-sum-card teal"><div class="avp-sum-label">মোট গ্রাহক</div><div class="avp-sum-value">${list.length}জন</div><div class="avp-sum-sub">সকল রেকর্ড</div></div>
    <div class="avp-sum-card purple"><div class="avp-sum-label">আদায়ের হার</div><div class="avp-sum-value">${totalAmount>0?Math.round(totalPaid/totalAmount*100):0}%</div><div class="avp-sum-sub">অগ্রগতি</div></div>
  `;

  if(!list.length){
    tableEl.innerHTML = `<div class="avp-empty"><i class="fa-solid fa-check-circle" style="color:var(--accent)"></i><p>কোনো বাকি তথ্য পাওয়া যায়নি</p></div>`;
    return;
  }

  tableEl.innerHTML = `
    <div class="avp-table-head">
      <h4><i class="fa-solid fa-hand-holding-dollar"></i> সকল বাকির তালিকা</h4>
      <span class="avp-count-badge">${list.length} টি রেকর্ড</span>
    </div>
    <div class="avp-table-overflow">
      <table class="avp-table">
        <thead><tr>
          <th>গ্রাহক</th>
          <th>পণ্য</th>
          <th>তারিখ</th>
          <th>মোট ধার</th>
          <th>পরিশোধ</th>
          <th>বকেয়া</th>
          <th>আদায়ের অগ্রগতি</th>
          <th>পরিশোধের তারিখ</th>
          <th>স্ট্যাটাস</th>
        </tr></thead>
        <tbody>
          ${list.map(d=>{
            const days = d.dueDate?daysUntil(d.dueDate):null;
            const isOverdue = days!==null&&days<0&&safeNum(d.dueAmount)>0;
            const isPaid = safeNum(d.dueAmount)<=0;
            const totalAmt = safeNum(d.totalAmount||d.total||0);
            const paidAmt  = safeNum(d.paidAmount||0);
            const progress = totalAmt>0?Math.min(100,Math.round(paidAmt/totalAmt*100)):100;
            return `<tr class="avp-clickable-row" onclick="openAllViewDetail('dues','${d.id}')">
              <td><b>${safeText(d.customerName)}</b>${d.phone?`<br><small style="color:var(--text-4)">${safeText(d.phone)}</small>`:""}</td>
              <td>${safeText(d.productName||"-")}</td>
              <td>${d.date||"-"}</td>
              <td style="text-align:right;font-weight:700">${money(totalAmt)}</td>
              <td style="text-align:right;color:var(--accent-2);font-weight:700">${money(paidAmt)}</td>
              <td style="text-align:right;font-weight:800;color:${isOverdue?"var(--rose-2)":"var(--soil-mid)"}">${money(d.dueAmount)}</td>
              <td>
                <div style="display:flex;align-items:center;gap:6px">
                  <div style="flex:1;height:8px;background:#e5e7eb;border-radius:4px;overflow:hidden">
                    <div style="height:100%;width:${progress}%;background:${isPaid?"var(--accent-2)":isOverdue?"var(--rose)":"var(--sky)"};border-radius:4px;transition:width .3s"></div>
                  </div>
                  <span style="font-size:.7rem;font-weight:700;color:var(--text-3);min-width:28px">${progress}%</span>
                </div>
              </td>
              <td class="${isOverdue?"avp-due-overdue":""}">${d.dueDate||"-"}${isOverdue?`<br><small>⚠️ ${Math.abs(days)}দিন পেরিয়েছে</small>`:""}</td>
              <td><span class="badge ${isPaid?"green":isOverdue?"red":"amber"}">${isPaid?"পরিশোধিত":isOverdue?"মেয়াদ উত্তীর্ণ":"বকেয়া"}</span></td>
            </tr>`;
          }).join("")}
        </tbody>
      </table>
    </div>
  `;
}

/* ══════════ UNIFIED DETAIL VIEW ══════════ */
function openAllViewDetail(type, id){
  const detailView = $("avDetailView");
  const content    = $("avDetailContent");
  const title      = $("avDetailTitle");
  if(!detailView||!content) return;

  if(type==="sales"){
    const s = sales.find(x=>x.id===id);
    if(!s) return;
    title.innerHTML = `<i class="fa-solid fa-receipt"></i> বিক্রয় বিস্তারিত — #${s.id}`;
    const items = s.items||[{productName:s.productName,quantity:s.quantity,price:s.price,discount:s.discount||0,total:s.total}];
    const totalQty = items.reduce((t,i)=>t+safeNum(i.quantity),0);
    content.innerHTML = `<div class="avt-detail-body">
      <div class="avd-section">
        <div class="avd-sec-head"><h4><i class="fa-solid fa-info-circle"></i> মূল তথ্য</h4></div>
        <div class="avd-sec-body">
          <div class="avd-info-grid">
            <div class="avd-info-item"><div class="avd-info-label">ইনভয়েস নম্বর</div><div class="avd-info-value">${s.id}</div></div>
            <div class="avd-info-item"><div class="avd-info-label">তারিখ</div><div class="avd-info-value">${s.date||"-"}</div></div>
            <div class="avd-info-item"><div class="avd-info-label">সময়</div><div class="avd-info-value">${formatTime(s)}</div></div>
            <div class="avd-info-item"><div class="avd-info-label">গ্রাহকের নাম</div><div class="avd-info-value">${safeText(s.customerName||"সাধারণ ক্রেতা")}</div></div>
            <div class="avd-info-item"><div class="avd-info-label">মোবাইল</div><div class="avd-info-value">${s.customerPhone?safeText(s.customerPhone):"-"}</div></div>
            <div class="avd-info-item"><div class="avd-info-label">গ্রাম</div><div class="avd-info-value">${s.village?safeText(s.village):"-"}</div></div>
            <div class="avd-info-item"><div class="avd-info-label">বিক্রয় ধরন</div><div class="avd-info-value">${s.saleType||"খুচরা"}</div></div>
            <div class="avd-info-item"><div class="avd-info-label">পেমেন্ট পদ্ধতি</div><div class="avd-info-value">${safeText(s.paymentMethod||"-")}</div></div>
            ${s.note?`<div class="avd-info-item"><div class="avd-info-label">নোট</div><div class="avd-info-value">${safeText(s.note)}</div></div>`:""}
          </div>
        </div>
      </div>
      <div class="avd-section">
        <div class="avd-sec-head"><h4><i class="fa-solid fa-seedling"></i> বিক্রীত পণ্য তালিকা</h4></div>
        <div class="avd-sec-body" style="padding:0">
          <table class="avp-table">
            <thead><tr><th>পণ্য</th><th>পরিমাণ</th><th>একক মূল্য</th><th>ছাড়</th><th>মোট</th><th>লাভ</th></tr></thead>
            <tbody>${items.map(item=>{
              const p = products.find(x=>x.id===item.productId);
              const profit = p?((safeNum(item.price)-safeNum(p.purchasePrice))*safeNum(item.quantity)-safeNum(item.discount||0)):"-";
              return `<tr>
                <td><b>${safeText(item.productName||"-")}</b></td>
                <td style="text-align:center">${item.quantity}</td>
                <td style="text-align:right">${money(item.price)}</td>
                <td style="text-align:right">${money(item.discount||0)}</td>
                <td style="text-align:right;font-weight:700;color:var(--brand)">${money(item.total)}</td>
                <td style="text-align:right;color:var(--accent-2);font-weight:700">${typeof profit==="number"?money(profit):"-"}</td>
              </tr>`;
            }).join("")}</tbody>
          </table>
        </div>
      </div>
      <div class="avd-section">
        <div class="avd-sec-head"><h4><i class="fa-solid fa-calculator"></i> আর্থিক হিসাব</h4></div>
        <div class="avd-sec-body">
          <div class="avd-analytics-grid">
            <div class="avd-analytics-item"><div class="lbl">মোট পণ্য পরিমাণ</div><div class="val">${totalQty}টি</div></div>
            <div class="avd-analytics-item"><div class="lbl">মোট বিক্রয় মূল্য</div><div class="val">${money(s.total)}</div></div>
            <div class="avd-analytics-item"><div class="lbl">প্রাপ্ত অর্থ</div><div class="val profit">${money(safeNum(s.paidAmount)||safeNum(s.total))}</div></div>
            <div class="avd-analytics-item"><div class="lbl">বাকি অর্থ</div><div class="val cost">${money(s.dueAmount||0)}</div></div>
            <div class="avd-analytics-item"><div class="lbl">মোট লাভ</div><div class="val profit">${money(s.profit)}</div></div>
          </div>
        </div>
      </div>
      <div style="padding:0 0 16px;display:flex;gap:10px;flex-wrap:wrap">
        <button class="btn btn-primary" onclick="printSaleInvoice('${s.id}')"><i class="fa-solid fa-print"></i> ইনভয়েস প্রিন্ট</button>
        <button class="btn btn-danger" onclick="if(confirm('এই বিক্রয় মুছে ফেলবেন?')){deleteSale('${s.id}');hideAllViewDetail();renderAllViewSales();}"><i class="fa-solid fa-trash"></i> মুছুন</button>
      </div>
    </div>`;

  } else if(type==="products"){
    const p = products.find(x=>x.id===id);
    if(!p) return;
    const soldQty = (()=>{let t=0;sales.forEach(s=>(s.items||[{productId:s.productId,quantity:s.quantity}]).forEach(i=>{if(i.productId===p.id)t+=safeNum(i.quantity);}));return t;})();
    const stockCost  = safeNum(p.stock)*safeNum(p.purchasePrice);
    const stockSell  = safeNum(p.stock)*safeNum(p.sellingPrice);
    const possProfit = stockSell - stockCost;
    const totalSoldAmt = sales.reduce((t,s)=>{
      const items = s.items||[];
      return t+items.filter(i=>i.productId===p.id).reduce((st,i)=>st+safeNum(i.total||0),0);
    },0);
    const isSeed = p.mainCat==="বীজ";
    title.innerHTML = `<i class="fa-solid fa-seedling"></i> পণ্য বিস্তারিত — ${safeText(p.name)}`;
    content.innerHTML = `<div class="avt-detail-body">
      <div class="avd-section">
        <div class="avd-sec-head"><h4><i class="fa-solid fa-info-circle"></i> পণ্যের মূল তথ্য</h4></div>
        <div class="avd-sec-body">
          <div class="avd-info-grid">
            <div class="avd-info-item"><div class="avd-info-label">পণ্যের নাম</div><div class="avd-info-value large">${safeText(p.name)}</div></div>
            <div class="avd-info-item"><div class="avd-info-label">ব্র্যান্ড</div><div class="avd-info-value">${safeText(p.brand||"-")}</div></div>
            <div class="avd-info-item"><div class="avd-info-label">প্রধান ক্যাটাগরি</div><div class="avd-info-value">${isSeed?"🌱 বীজ":"🧪 কীটনাশক"}</div></div>
            <div class="avd-info-item"><div class="avd-info-label">সাব ক্যাটাগরি</div><div class="avd-info-value">${safeText(p.subCat||"-")}</div></div>
            <div class="avd-info-item"><div class="avd-info-label">ভ্যারাইটি</div><div class="avd-info-value">${safeText(p.variety||"-")}</div></div>
            <div class="avd-info-item"><div class="avd-info-label">প্যাক সাইজ</div><div class="avd-info-value">${safeText(p.packSize||"-")}</div></div>
            <div class="avd-info-item"><div class="avd-info-label">ইউনিট</div><div class="avd-info-value">${safeText(p.unit||"প্যাকেট")}</div></div>
            <div class="avd-info-item"><div class="avd-info-label">ব্যাচ নম্বর</div><div class="avd-info-value">${safeText(p.batchNo||"-")}</div></div>
            <div class="avd-info-item"><div class="avd-info-label">উৎপাদন তারিখ</div><div class="avd-info-value">${p.mfgDate||"-"}</div></div>
            <div class="avd-info-item"><div class="avd-info-label">মেয়াদ উত্তীর্ণ</div><div class="avd-info-value ${p.expDate&&daysUntil(p.expDate)!==null&&daysUntil(p.expDate)<=30?"rose":""}">${p.expDate||"-"}</div></div>
            ${isSeed?`<div class="avd-info-item"><div class="avd-info-label">অঙ্কুরোদগম হার</div><div class="avd-info-value">${p.germRate||"-"}%</div></div>
            <div class="avd-info-item"><div class="avd-info-label">মৌসুম</div><div class="avd-info-value">${safeText(p.season||"-")}</div></div>
            <div class="avd-info-item"><div class="avd-info-label">ফসলের ধরন</div><div class="avd-info-value">${safeText(p.cropType||"-")}</div></div>`
            :`<div class="avd-info-item"><div class="avd-info-label">সক্রিয় উপাদান</div><div class="avd-info-value">${safeText(p.activeIng||"-")}</div></div>
            <div class="avd-info-item"><div class="avd-info-label">ডোজ</div><div class="avd-info-value">${safeText(p.dosage||"-")}</div></div>
            <div class="avd-info-item"><div class="avd-info-label">লক্ষ্য কীটপতঙ্গ</div><div class="avd-info-value">${safeText(p.target||"-")}</div></div>`}
            <div class="avd-info-item"><div class="avd-info-label">সর্বশেষ আপডেট</div><div class="avd-info-value">${p.updatedAt?new Date(p.updatedAt).toLocaleDateString("bn-BD"):"-"}</div></div>
          </div>
        </div>
      </div>
      <div class="avd-section">
        <div class="avd-sec-head"><h4><i class="fa-solid fa-coins"></i> মূল্য ও স্টক বিশ্লেষণ</h4></div>
        <div class="avd-sec-body">
          <div class="avd-analytics-grid">
            <div class="avd-analytics-item"><div class="lbl">বর্তমান স্টক</div><div class="val">${p.stock} ${p.unit||""}</div></div>
            <div class="avd-analytics-item"><div class="lbl">একক ক্রয়মূল্য</div><div class="val cost">${money(p.purchasePrice)}</div></div>
            <div class="avd-analytics-item"><div class="lbl">একক বিক্রয়মূল্য</div><div class="val">${money(p.sellingPrice)}</div></div>
            ${p.wholesalePrice?`<div class="avd-analytics-item"><div class="lbl">পাইকারি মূল্য</div><div class="val">${money(p.wholesalePrice)}</div></div>`:""}
            <div class="avd-analytics-item"><div class="lbl">স্টক (ক্রয়) মূল্য</div><div class="val cost">${money(stockCost)}</div></div>
            <div class="avd-analytics-item"><div class="lbl">স্টক (বিক্রয়) মূল্য</div><div class="val">${money(stockSell)}</div></div>
            <div class="avd-analytics-item"><div class="lbl">সম্ভাব্য লাভ</div><div class="val profit">${money(possProfit)}</div></div>
            <div class="avd-analytics-item"><div class="lbl">কম স্টক সীমা</div><div class="val">${p.lowStockLimit||5} ${p.unit||""}</div></div>
            <div class="avd-analytics-item"><div class="lbl">মোট বিক্রীত পরিমাণ</div><div class="val profit">${soldQty} ${p.unit||""}</div></div>
            <div class="avd-analytics-item"><div class="lbl">মোট বিক্রয় রাজস্ব</div><div class="val">${money(totalSoldAmt)}</div></div>
          </div>
        </div>
      </div>
      <div style="padding:0 0 16px;display:flex;gap:10px;flex-wrap:wrap">
        <button class="btn btn-primary" onclick="editProduct('${p.id}');closeAllView()"><i class="fa-solid fa-pen"></i> সম্পাদনা</button>
        <button class="btn btn-danger" onclick="deleteProduct('${p.id}');hideAllViewDetail();renderAllViewProducts()"><i class="fa-solid fa-trash"></i> মুছুন</button>
      </div>
    </div>`;

  } else if(type==="dues"){
    const d = dues.find(x=>x.id===id);
    if(!d) return;
    const payments = d.payments||[];
    const days = d.dueDate?daysUntil(d.dueDate):null;
    const isOverdue = days!==null&&days<0&&safeNum(d.dueAmount)>0;
    const isPaid = safeNum(d.dueAmount)<=0;
    const totalAmt = safeNum(d.totalAmount||d.total||0);
    const paidAmt  = safeNum(d.paidAmount||0);
    const progress = totalAmt>0?Math.min(100,Math.round(paidAmt/totalAmt*100)):100;
    title.innerHTML = `<i class="fa-solid fa-hand-holding-dollar"></i> বাকি বিস্তারিত — ${safeText(d.customerName)}`;
    content.innerHTML = `<div class="avt-detail-body">
      <div class="avd-section">
        <div class="avd-sec-head"><h4><i class="fa-solid fa-user"></i> গ্রাহকের তথ্য</h4></div>
        <div class="avd-sec-body">
          <div class="avd-info-grid">
            <div class="avd-info-item"><div class="avd-info-label">গ্রাহকের নাম</div><div class="avd-info-value large">${safeText(d.customerName)}</div></div>
            <div class="avd-info-item"><div class="avd-info-label">মোবাইল</div><div class="avd-info-value">${d.phone?safeText(d.phone):"-"}</div></div>
            <div class="avd-info-item"><div class="avd-info-label">পণ্য</div><div class="avd-info-value">${safeText(d.productName||"-")}</div></div>
            <div class="avd-info-item"><div class="avd-info-label">তারিখ</div><div class="avd-info-value">${d.date||"-"}</div></div>
            <div class="avd-info-item"><div class="avd-info-label">পরিশোধের তারিখ</div><div class="avd-info-value ${isOverdue?"rose":""}">${d.dueDate||"-"}</div></div>
            ${d.note?`<div class="avd-info-item"><div class="avd-info-label">নোট</div><div class="avd-info-value">${safeText(d.note)}</div></div>`:""}
          </div>
        </div>
      </div>
      <div class="avd-section">
        <div class="avd-sec-head"><h4><i class="fa-solid fa-calculator"></i> আর্থিক হিসাব</h4></div>
        <div class="avd-sec-body">
          <div class="avd-analytics-grid">
            <div class="avd-analytics-item"><div class="lbl">মোট ধারের পরিমাণ</div><div class="val">${money(totalAmt)}</div></div>
            <div class="avd-analytics-item"><div class="lbl">মোট পরিশোধিত</div><div class="val profit">${money(paidAmt)}</div></div>
            <div class="avd-analytics-item"><div class="lbl">অবশিষ্ট বকেয়া</div><div class="val cost">${money(d.dueAmount)}</div></div>
            <div class="avd-analytics-item"><div class="lbl">আদায়ের হার</div><div class="val profit">${progress}%</div></div>
            <div class="avd-analytics-item"><div class="lbl">স্ট্যাটাস</div><div class="val ${isPaid?"profit":isOverdue?"cost":""}">${isPaid?"✓ পরিশোধিত":isOverdue?"⚠️ মেয়াদ উত্তীর্ণ":"বকেয়া"}</div></div>
          </div>
          <div style="margin-top:14px">
            <div style="display:flex;align-items:center;gap:10px;margin-bottom:6px">
              <div style="font-size:.78rem;color:var(--text-3)">আদায়ের অগ্রগতি:</div>
              <span style="font-weight:700;font-size:.82rem">${progress}%</span>
            </div>
            <div style="height:12px;background:#e5e7eb;border-radius:6px;overflow:hidden">
              <div style="height:100%;width:${progress}%;background:${isPaid?"var(--accent-2)":isOverdue?"var(--rose)":"var(--sky)"};border-radius:6px;transition:width .5s"></div>
            </div>
          </div>
        </div>
      </div>
      ${payments.length?`<div class="avd-section">
        <div class="avd-sec-head"><h4><i class="fa-solid fa-clock-rotate-left"></i> পরিশোধের ইতিহাস (${payments.length}টি)</h4></div>
        <div class="avd-sec-body">
          ${[...payments].sort((a,b)=>(b.createdAt||b.date||"").localeCompare(a.createdAt||a.date||"")).map(pay=>`
            <div class="avd-payment-hist-item">
              <div>
                <div style="font-weight:700;color:var(--text-1)">${money(pay.amount)}</div>
                <div style="font-size:.74rem;color:var(--text-4)">${pay.date||"-"} · ${pay.method||"নগদ"}</div>
                ${pay.note?`<div style="font-size:.74rem;color:var(--text-3)">${safeText(pay.note)}</div>`:""}
              </div>
              <span class="badge green">আদায়কৃত</span>
            </div>`).join("")}
        </div>
      </div>`:""}
      <div style="padding:0 0 16px;display:flex;gap:10px;flex-wrap:wrap">
        ${!isPaid?`<button class="btn btn-success" onclick="collectDue('${d.id}')"><i class="fa-solid fa-hand-holding-dollar"></i> আদায় করুন</button>`:""}
        <button class="btn btn-danger" onclick="deleteDue('${d.id}');hideAllViewDetail();renderAllViewDues()"><i class="fa-solid fa-trash"></i> মুছুন</button>
      </div>
    </div>`;
  }

  detailView.classList.add("show");
  detailView.style.display = "flex";
  detailView.scrollTop = 0;
}

function hideAllViewDetail(){
  const detailView = $("avDetailView");
  if(detailView){ detailView.classList.remove("show"); detailView.style.display = "none"; }
}

/* ---- Export CSV ---- */
function exportAllViewCSV(){
  let csv = "";
  const tab = allViewActiveTab;
  if(tab==="sales"){
    csv = "তারিখ,ক্রেতা,পণ্য,পরিমাণ,মোট,প্রাপ্ত,বাকি,লাভ,পেমেন্ট,ধরন\n";
    sales.forEach(s=>{
      const items = s.items||[{productName:s.productName,quantity:s.quantity}];
      csv += `"${s.date}","${s.customerName||""}","${items.map(i=>i.productName).join("+")}","${items.reduce((t,i)=>t+safeNum(i.quantity),0)}","${s.total}","${s.paidAmount||s.total}","${s.dueAmount||0}","${s.profit||0}","${s.paymentMethod}","${s.saleType||"খুচরা"}"\n`;
    });
  } else if(tab==="products"){
    csv = "পণ্যের নাম,ক্যাটাগরি,স্টক,ক্রয়মূল্য,বিক্রয়মূল্য,স্টক ক্রয়মূল্য,স্টক বিক্রয়মূল্য,সম্ভাব্য লাভ\n";
    products.forEach(p=>{
      const sc = safeNum(p.stock)*safeNum(p.purchasePrice);
      const ss = safeNum(p.stock)*safeNum(p.sellingPrice);
      csv += `"${p.name}","${p.mainCat}","${p.stock} ${p.unit||""}","${p.purchasePrice}","${p.sellingPrice}","${sc}","${ss}","${ss-sc}"\n`;
    });
  } else if(tab==="dues"){
    csv = "গ্রাহক,পণ্য,তারিখ,মোট ধার,পরিশোধ,বকেয়া,স্ট্যাটাস\n";
    dues.forEach(d=>{
      const isPaid = safeNum(d.dueAmount)<=0;
      csv += `"${d.customerName}","${d.productName||""}","${d.date||""}","${d.totalAmount||d.total||0}","${d.paidAmount||0}","${d.dueAmount||0}","${isPaid?"পরিশোধিত":"বকেয়া"}"\n`;
    });
  }
  const blob = new Blob(["\uFEFF"+csv],{type:"text/csv;charset=utf-8;"});
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement("a");
  a.href = url; a.download = `srks-${tab}-${todayISO()}.csv`; a.click();
  URL.revokeObjectURL(url);
  showToast("CSV ডাউনলোড হচ্ছে ✓");
}

/* ---- Hook into dashboard card modal: clicking a row opens All View detail ---- */
/* Override buildSaleDetailTable to add clickable rows that go to All View */
const _origBuildSaleTable = buildSaleDetailTable;
window.buildSaleDetailTable = function(list, showProfit=false){
  if(!list.length) return `<div class="dm-empty"><i class="fa-solid fa-inbox"></i><p>কোনো তথ্য পাওয়া যায়নি</p></div>`;
  return `<div class="dm-table-wrap"><table class="dm-table">
    <thead><tr>
      <th>সময়</th><th>পণ্য</th><th>ক্রেতা</th>
      <th>পরিমাণ</th><th>মোট</th>
      ${showProfit?'<th>লাভ</th>':''}
      <th>পেমেন্ট</th><th>ধরন</th><th>বিস্তারিত</th>
    </tr></thead>
    <tbody>${list.map(s=>{
      const pmClass=s.paymentMethod==="সম্পূর্ণ নগদ"?"cash"
        :s.paymentMethod==="মোবাইল ব্যাংকিং"?"mobile"
        :s.paymentMethod==="সম্পূর্ণ বাকি"||safeNum(s.dueAmount)>0?"due":"cash";
      return `<tr>
        <td style="white-space:nowrap">${s.date}<br><small style="color:var(--text-4)">${formatTime(s)}</small></td>
        <td><b>${safeText(s.productName)}</b></td>
        <td>${s.customerName?safeText(s.customerName):'-'}${s.village?`<br><small>${safeText(s.village)}</small>`:''}</td>
        <td style="text-align:center">${s.quantity}</td>
        <td style="text-align:right;font-weight:700;color:var(--brand)">${money(s.total)}</td>
        ${showProfit?`<td style="text-align:right;color:var(--accent-2);font-weight:700">${money(s.profit)}</td>`:''}
        <td><span class="payment-badge-sm ${pmClass}">${safeText(s.paymentMethod||'-')}</span>
          ${safeNum(s.dueAmount)>0?`<br><small style="color:var(--rose-mid)">বাকি: ${money(s.dueAmount)}</small>`:''}</td>
        <td><span class="badge ${s.saleType==='পাইকারি'?'blue':'green'}">${s.saleType||'খুচরা'}</span></td>
        <td><button class="btn btn-sm btn-primary" onclick="closeDetailModal();openAllView('sales','${s.id}')" title="সব (All)-এ বিস্তারিত দেখুন" style="font-size:.7rem;padding:4px 8px"><i class="fa-solid fa-arrow-up-right-from-square"></i></button></td>
      </tr>`;
    }).join('')}</tbody>
  </table></div>`;
};

const _origBuildDueTable = buildDueDetailTable;
window.buildDueDetailTable = function(list){
  if(!list.length) return `<div class="dm-empty"><i class="fa-solid fa-circle-check" style="color:var(--green-bright)"></i><p>কোনো বকেয়া নেই</p></div>`;
  return `<div class="dm-table-wrap"><table class="dm-table">
    <thead><tr><th>ক্রেতা</th><th>পণ্য</th><th>মোট পরিমাণ</th><th>পরিশোধিত</th><th>বকেয়া</th><th>তারিখ</th><th>বিস্তারিত</th></tr></thead>
    <tbody>${list.map(d=>{
      const days=d.dueDate?daysUntil(d.dueDate):null;
      const isOverdue=days!==null&&days<0;
      return `<tr>
        <td><b>${safeText(d.customerName)}</b>${d.phone?`<br><small>${safeText(d.phone)}</small>`:''}</td>
        <td>${safeText(d.productName||'-')}</td>
        <td style="text-align:right">${money(d.totalAmount)}</td>
        <td style="text-align:right;color:var(--green-dark)">${money(d.paidAmount)}</td>
        <td style="text-align:right;font-weight:700;color:${isOverdue?'var(--rose-mid)':'var(--soil-mid)'}"> ${money(d.dueAmount)}</td>
        <td>${d.dueDate||d.date||'-'}${isOverdue?`<br><span style="font-size:.7rem;color:var(--rose-mid)">⚠️ ${Math.abs(days)} দিন পেরিয়েছে</span>`:''}</td>
        <td><button class="btn btn-sm btn-primary" onclick="closeDetailModal();openAllView('dues','${d.id}')" title="সব (All)-এ বিস্তারিত দেখুন" style="font-size:.7rem;padding:4px 8px"><i class="fa-solid fa-arrow-up-right-from-square"></i></button></td>
      </tr>`;
    }).join('')}</tbody>
  </table></div>`;
};

/* ---- Dashboard card click to All View for product cards ---- */
/* Override stock kpi cards to link to all view */
function goToAllProducts(){
  openAllView("products");
}

/* ---- Init ---- */
window.addEventListener("load",()=>{
  initAllView();
}, true);

/* ===================== Pagination Helpers ===================== */
function salesNextPage(){
  const typeFilter=$("salesFilterType")?.value||"";
  let list=sales;
  if(typeFilter) list=list.filter(s=>s.saleType===typeFilter);
  if(salesPageOffset+salesPageSize<list.length){
    salesPageOffset+=salesPageSize;
    renderSales();
    $("salesTable")?.closest(".card")?.scrollIntoView({behavior:"smooth",block:"start"});
  }
}
function salesPrevPage(){
  if(salesPageOffset>0){
    salesPageOffset=Math.max(0,salesPageOffset-salesPageSize);
    renderSales();
    $("salesTable")?.closest(".card")?.scrollIntoView({behavior:"smooth",block:"start"});
  }
}

/* ===================== Data Backup Export ===================== */
function exportFullBackup(){
  try{
    const backup={
      exportDate: new Date().toISOString(),
      shopName: settings.shopName||"SRKS",
      products,
      sales,
      dues,
      withdrawals,
      settings: {...settings, adminPass:"[hidden]"}
    };
    const json=JSON.stringify(backup,null,2);
    const blob=new Blob([json],{type:"application/json;charset=utf-8;"});
    const url=URL.createObjectURL(blob);
    const a=document.createElement("a");
    a.href=url;
    a.download=`srks-backup-${todayISO()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showToast("ব্যাকআপ ডাউনলোড হচ্ছে ✓");
  }catch(e){
    showToast("ব্যাকআপ তৈরিতে সমস্যা হয়েছে");
    console.error(e);
  }
}

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
window.openAllView=openAllView;
window.closeAllView=closeAllView;
window.openAllViewDetail=openAllViewDetail;
window.hideAllViewDetail=hideAllViewDetail;
window.goToAllProducts=goToAllProducts;
window.renderAllViewSales=renderAllViewSales;
window.renderAllViewProducts=renderAllViewProducts;
window.renderAllViewDues=renderAllViewDues;
window.openPartialSoldReport=openPartialSoldReport;
window.closePartialSoldReport=closePartialSoldReport;
window.salesNextPage=salesNextPage;
window.salesPrevPage=salesPrevPage;
window.exportFullBackup=exportFullBackup;
