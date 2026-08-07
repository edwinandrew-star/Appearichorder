const SUPABASE_URL = 'https://zudqubbglwphfxaviqsg.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inp1ZHF1YmJnbHdwaGZ4YXZpcXNnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI0NjcyNTUsImV4cCI6MjA5ODA0MzI1NX0.7pRbRqz9-5gN8SG_ALn5ecHOWQofykPvhbrE2HQROCE';
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

let currentUser = null;
let currentUsername = "";
let currentUserPhone = "";
let isRegisterMode = false;
let deferredPrompt = null;

// Persistent storage initialization with fallback offline support
let activeOrders = JSON.parse(localStorage.getItem('appearich_active_orders')) || [];
let completedHistory = JSON.parse(localStorage.getItem('appearich_history')) || [];
let completedOrdersCount = parseInt(localStorage.getItem('appearich_loyalty_count')) || 0;

let selectedPerfumeSizeName = "30ml";
let selectedPerfumePrice = 25000;
let selectedPaymentType = 'cash';
let selectedFoodItems = [];

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('service-worker.js')
      .then(reg => console.log('ServiceWorker registered:', reg.scope))
      .catch(err => console.log('ServiceWorker failed:', err));
  });
}

window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredPrompt = e;
  document.getElementById('pwaInstallBtn').style.display = 'flex';
});

function installPWA() {
  if (deferredPrompt) {
    deferredPrompt.prompt();
    deferredPrompt.userChoice.then((choiceResult) => {
      if (choiceResult.outcome === 'accepted') {
        document.getElementById('pwaInstallBtn').style.display = 'none';
      }
      deferredPrompt = null;
    });
  }
}

window.addEventListener('DOMContentLoaded', async () => {
  const { data: { session } } = await supabaseClient.auth.getSession();
  
  setTimeout(async () => {
    document.getElementById('splash-screen').style.opacity = '0';
    setTimeout(() => {
      document.getElementById('splash-screen').style.display = 'none';
    }, 500);
    if (session && session.user) {
      currentUser = session.user;
      await fetchAndSetupUserData(currentUser.id);
      await syncOrdersFromSupabase();
    } else {
      showAuthScreen();
    }
  }, 800);
  
  loadSavedUserLocation();
  updateLoyaltyUI();
  renderBookings();
  renderHistory();
  renderSelectedItems();
});

async function fetchAndSetupUserData(userId) {
  const { data, error } = await supabaseClient
    .from('profiles')
    .select('username, phone')
    .eq('id', userId)
    .single();
  
  if (data) {
    if (data.username) currentUsername = data.username;
    if (data.phone) currentUserPhone = data.phone;
  }
  if (!currentUsername) {
    currentUsername = localStorage.getItem('appearich_username') || currentUser.email.split('@')[0];
  }
  if (!currentUserPhone) {
    currentUserPhone = localStorage.getItem('appearich_phone') || "+255 764 519 027";
  }
  localStorage.setItem('appearich_username', currentUsername);
  localStorage.setItem('appearich_phone', currentUserPhone);
  setupUserInterface();
}

async function syncOrdersFromSupabase() {
  try {
    const { data, error } = await supabaseClient
      .from('orders')
      .select('*')
      .eq('user_id', currentUser.id)
      .order('created_at', { ascending: false });
    
    if (data && data.length > 0) {
      activeOrders = data.map(row => ({
        id: row.order_id,
        items: row.items || [],
        total: row.total,
        location: row.location,
        instructions: row.instructions || 'None',
        paymentMethod: row.payment_method || 'Cash on Delivery',
        dateTime: new Date(row.created_at).toLocaleString(),
        status: row.status || 'confirmed'
      }));
      localStorage.setItem('appearich_active_orders', JSON.stringify(activeOrders));
      renderBookings();
    }
  } catch (e) {
    console.log("Offline mode: using local cache for orders.", e);
  }
}

function showAuthScreen() {
  document.getElementById('screen-auth').style.display = 'flex';
  document.getElementById('mainHeader').style.display = 'none';
  document.getElementById('mainNavBar').style.display = 'none';
  document.querySelectorAll('.app-screen').forEach(s => {
    if(s.id !== 'screen-auth') s.classList.remove('active');
  });
}

function setupUserInterface() {
  document.getElementById('screen-auth').style.display = 'none';
  document.getElementById('mainHeader').style.display = 'flex';
  document.getElementById('mainNavBar').style.display = 'flex';
  switchTab('screen-home', document.getElementById('nav-home-btn'));
  document.getElementById('heroGreeting').innerText = `Welcome, ${currentUsername}!`;
  document.getElementById('profName').innerText = currentUsername;
  document.getElementById('profAvatar').innerText = currentUsername.charAt(0).toUpperCase();
  document.getElementById('profPhone').innerText = currentUserPhone;
}

function toggleAuthMode() {
  isRegisterMode = !isRegisterMode;
  document.getElementById('authTitle').innerText = isRegisterMode ? "Create Account" : "Welcome Back";
  document.getElementById('authSub').innerText = isRegisterMode ? "Sign up to start ordering with Appearich" : "Sign in to your Appearich account";
  document.getElementById('authSubmitBtn').innerText = isRegisterMode ? "Register" : "Sign In";
  document.getElementById('authSwitchText').innerHTML = isRegisterMode ? "Already have an account? <span>Sign In</span>" : "Don't have an account? <span>Register here</span>";
  document.getElementById('usernameGroup').style.display = isRegisterMode ? "block" : "none";
  document.getElementById('phoneGroup').style.display = isRegisterMode ? "block" : "none";
}

async function handleAuthSubmit() {
  const email = document.getElementById('authEmail').value.trim();
  const password = document.getElementById('authPassword').value.trim();
  const username = document.getElementById('authUsername').value.trim();
  const phone = document.getElementById('authPhone').value.trim();
  
  if (!email || !password) {
    alert("Please enter both email and password.");
    return;
  }
  if (isRegisterMode) {
    if (!username || !phone) {
      alert("Please provide both a username and a phone number.");
      return;
    }
    const { data, error } = await supabaseClient.auth.signUp({ email, password });
    if (error) {
      alert("Registration Error: " + error.message);
    } else {
      currentUser = data.user;
      currentUsername = username;
      currentUserPhone = phone;
      
      if (currentUser) {
        await supabaseClient.from('profiles').upsert([
          { id: currentUser.id, username: username, email: email, phone: phone }
        ]);
      }
      localStorage.setItem('appearich_username', username);
      localStorage.setItem('appearich_phone', phone);
      alert("Registration successful! Welcome, " + username);
      setupUserInterface();
    }
  } else {
    const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password });
    if (error) {
      alert("Login Error: " + error.message);
    } else {
      currentUser = data.user;
      await fetchAndSetupUserData(currentUser.id);
      await syncOrdersFromSupabase();
    }
  }
}

async function handleLogout() {
  await supabaseClient.auth.signOut();
  localStorage.removeItem('appearich_username');
  localStorage.removeItem('appearich_phone');
  currentUser = null;
  currentUsername = "";
  currentUserPhone = "";
  showAuthScreen();
}

function loadSavedUserLocation() {
  const savedBlock = localStorage.getItem('appearich_user_block');
  const savedRoom = localStorage.getItem('appearich_user_room');
  if (savedBlock) document.getElementById('mealBlockLoc').value = savedBlock;
  if (savedRoom) document.getElementById('mealRoomLoc').value = savedRoom;
}

function toggleTheme() {
  const currentTheme = document.documentElement.getAttribute('data-theme');
  const icon = document.querySelector('#themeToggleBtn i');
  if (currentTheme === 'dark') {
    document.documentElement.removeAttribute('data-theme');
    icon.className = 'fa-solid fa-moon';
  } else {
    document.documentElement.setAttribute('data-theme', 'dark');
    icon.className = 'fa-solid fa-sun';
  }
}

function switchTab(screenId, element) {
  document.querySelectorAll('.app-screen').forEach(s => s.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  const targetScreen = document.getElementById(screenId);
  if (targetScreen) targetScreen.classList.add('active');
  if (element) element.classList.add('active');
}

function goBack() {
  const homeBtn = document.getElementById('nav-home-btn');
  switchTab('screen-home', homeBtn);
}

function openHotMealsModal() { 
  loadSavedUserLocation();
  renderSelectedItems();
  document.getElementById('hotMealsModal').classList.add('active'); 
}

function openOrderModal() { document.getElementById('perfumesModal').classList.add('active'); }
function closeSheet(modalId) { document.getElementById(modalId).classList.remove('active'); }

function openProductModal(name) {
  document.getElementById('perfumeDesc').value = `Perfume: ${name}`;
  openOrderModal();
}

function selectPerfumeSize(el, sizeName, price) {
  document.querySelectorAll('#perfumesModal .price-card').forEach(c => c.classList.remove('active'));
  el.classList.add('active');
  selectedPerfumeSizeName = sizeName;
  selectedPerfumePrice = price;
}

function selectPaymentMethod(type) {
  selectedPaymentType = type;
  const btnCash = document.getElementById('payOptCash');
  const btnMobile = document.getElementById('payOptMobile');
  const unfoldBox = document.getElementById('mobileUnfoldArea');
  if (type === 'mobile') {
    btnMobile.classList.add('active');
    btnCash.classList.remove('active');
    unfoldBox.classList.add('active');
  } else {
    btnCash.classList.add('active');
    btnMobile.classList.remove('active');
    unfoldBox.classList.remove('active');
  }
}

function addItemToOrder(name, unitPrice) {
  const existing = selectedFoodItems.find(item => item.name === name);
  if (existing) { existing.qty += 1; } 
  else { selectedFoodItems.push({ name: name, unitPrice: unitPrice, qty: 1 }); }
  renderSelectedItems();
}

function updateItemQty(index, newQty) {
  const qty = parseInt(newQty) || 1;
  if (qty <= 0) { selectedFoodItems.splice(index, 1); } 
  else { selectedFoodItems[index].qty = qty; }
  renderSelectedItems();
}

function removeItem(index) {
  selectedFoodItems.splice(index, 1);
  renderSelectedItems();
}

function renderSelectedItems() {
  const container = document.getElementById('selectedItemsContainer');
  if (selectedFoodItems.length === 0) {
    container.innerHTML = `<p style="font-size:0.8rem; color:var(--text-sub); text-align:center;">No items added yet.</p>`;
  } else {
    container.innerHTML = selectedFoodItems.map((item, index) => `
      <div class="selected-item-row">
        <div class="selected-item-info">${item.name} (${item.unitPrice.toLocaleString()} TZS)</div>
        <div class="selected-item-ctrls">
          <label style="font-size:0.75rem;">Qty:</label>
          <input type="number" value="${item.qty}" min="1" onchange="updateItemQty(${index}, this.value)">
          <i class="fa-solid fa-trash" style="color:#e74c3c; cursor:pointer;" onclick="removeItem(${index})"></i>
        </div>
      </div>
    `).join('');
  }
  recalculateMealTotal();
}

function recalculateMealTotal() {
  const subtotal = selectedFoodItems.reduce((acc, item) => acc + (item.unitPrice * item.qty), 0);
  const surcharge = Math.round(subtotal * 0.25);
  const grandTotal = subtotal + surcharge;
  document.getElementById('displaySubtotal').innerText = subtotal.toLocaleString() + " TZS";
  document.getElementById('displaySurcharge').innerText = surcharge.toLocaleString() + " TZS";
  document.getElementById('displayGrandTotal').innerText = grandTotal.toLocaleString() + " TZS";
}

async function submitFoodOrder() {
  if (selectedFoodItems.length === 0) { alert("Please select at least one item!"); return; }
  const block = document.getElementById('mealBlockLoc').value.trim();
  const room = document.getElementById('mealRoomLoc').value.trim();
  const phone = currentUserPhone;
  const instructions = document.getElementById('mealDetails').value.trim() || "None";
  
  if (!block || !room) { alert("Please fill in location details."); return; }
  
  localStorage.setItem('appearich_user_block', block);
  localStorage.setItem('appearich_user_room', room);
  
  const orderId = "APR-" + Math.floor(1000 + Math.random() * 9000);
  const subtotal = selectedFoodItems.reduce((acc, item) => acc + (item.unitPrice * item.qty), 0);
  const surcharge = Math.round(subtotal * 0.25);
  const grandTotal = subtotal + surcharge;
  const dateTimeStr = new Date().toLocaleString();
  const paymentName = selectedPaymentType === 'cash' ? 'Cash on Delivery' : 'Mobile Money (Voda Lipa)';
  
  const newOrder = {
    id: orderId,
    items: selectedFoodItems,
    total: grandTotal,
    location: `${block}, Room ${room}`,
    instructions: instructions,
    paymentMethod: paymentName,
    dateTime: dateTimeStr,
    status: "confirmed"
  };
  
  activeOrders.unshift(newOrder);
  completedHistory.unshift(newOrder);
  completedOrdersCount += 1;
  localStorage.setItem('appearich_active_orders', JSON.stringify(activeOrders));
  localStorage.setItem('appearich_history', JSON.stringify(completedHistory));
  localStorage.setItem('appearich_loyalty_count', completedOrdersCount);
  
  renderBookings();
  renderHistory();
  updateLoyaltyUI();

  try {
    await supabaseClient.from('orders').insert([{
      order_id: orderId,
      user_id: currentUser ? currentUser.id : 'guest',
      items: selectedFoodItems,
      total: grandTotal,
      location: `${block}, Room ${room}`,
      instructions: instructions,
      payment_method: paymentName,
      status: 'confirmed'
    }]);
  } catch (e) {
    console.log("Cloud sync queued offline.", e);
  }
  
  let itemsListStr = selectedFoodItems.map(i => `• ${i.name} (x${i.qty}) - ${(i.unitPrice * i.qty).toLocaleString()} TZS`).join('\n');
  let waMessage = `*NEW APPEARICH ORDER*\n\n` +
    `🔖 *Order ID:* ${orderId}\n` +
    `👤 *Customer:* ${currentUsername}\n` +
    `📞 *Phone:* ${phone}\n` +
    `📍 *Location:* ${block}, Room ${room}\n` +
    `📝 *Instructions:* ${instructions}\n` +
    `📅 *Date & Time:* ${dateTimeStr}\n\n` +
    `📦 *Ordered Items:*\n${itemsListStr}\n\n` +
    `💰 *Total Order Amount:* ${grandTotal.toLocaleString()} TZS\n` +
    `💳 *Payment Method:* ${paymentName}`;
    
  selectedFoodItems = [];
  closeSheet('hotMealsModal');
  window.open(`https://wa.me/255764519027?text=${encodeURIComponent(waMessage)}`, '_blank');
}

async function submitPerfumeOrder() {
  const desc = document.getElementById('perfumeDesc').value.trim();
  const phone = currentUserPhone;
  const loc = document.getElementById('perfumeLoc').value.trim();
  if (!desc || !loc) { alert("Please fill in all details for your perfume order."); return; }
  
  const orderId = "APR-PRF-" + Math.floor(1000 + Math.random() * 9000);
  const dateTimeStr = new Date().toLocaleString();
  const perfumeItems = [{ name: `${desc} (${selectedPerfumeSizeName})`, unitPrice: selectedPerfumePrice, qty: 1 }];
  
  const newOrder = {
    id: orderId,
    items: perfumeItems,
    total: selectedPerfumePrice,
    location: loc,
    instructions: desc,
    paymentMethod: "Cash / Mobile Money",
    dateTime: dateTimeStr,
    status: "confirmed"
  };
  
  activeOrders.unshift(newOrder);
  completedHistory.unshift(newOrder);
  completedOrdersCount += 1;
  localStorage.setItem('appearich_active_orders', JSON.stringify(activeOrders));
  localStorage.setItem('appearich_history', JSON.stringify(completedHistory));
  localStorage.setItem('appearich_loyalty_count', completedOrdersCount);
  
  renderBookings();
  renderHistory();
  updateLoyaltyUI();

  try {
    await supabaseClient.from('orders').insert([{
      order_id: orderId,
      user_id: currentUser ? currentUser.id : 'guest',
      items: perfumeItems,
      total: selectedPerfumePrice,
      location: loc,
      instructions: desc,
      payment_method: "Cash / Mobile Money",
      status: 'confirmed'
    }]);
  } catch (e) {
    console.log("Cloud sync queued offline.", e);
  }
  
  let waMessage = `*NEW APPEARICH PERFUME ORDER*\n\n` +
    `🔖 *Order ID:* ${orderId}\n` +
    `👤 *Customer:* ${currentUsername}\n` +
    `📞 *Phone:* ${phone}\n` +
    `📍 *Location:* ${loc}\n` +
    `📅 *Date & Time:* ${dateTimeStr}\n\n` +
    `📦 *Ordered Products:*\n• ${desc} - Size: ${selectedPerfumeSizeName} (x1)\n\n` +
    `💰 *Total Order Amount:* ${selectedPerfumePrice.toLocaleString()} TZS\n` +
    `💳 *Payment Method:* Cash / Mobile Money`;
    
  closeSheet('perfumesModal');
  window.open(`https://wa.me/255764519027?text=${encodeURIComponent(waMessage)}`, '_blank');
}

function renderBookings() {
  const container = document.getElementById('bookingsListContainer');
  if (activeOrders.length === 0) {
    container.innerHTML = `<div style="text-align:center; padding:30px; color:var(--text-sub);">No active orders placed.</div>`;
    return;
  }
  container.innerHTML = activeOrders.map(o => `
    <div class="order-card-track">
      <div class="track-header">
        <span class="order-id">${o.id} - ${o.total.toLocaleString()} TZS</span>
        <span class="status-badge verified"><i class="fa-solid fa-check-double"></i> Confirmed</span>
      </div>
      <div class="track-details">
        <p><strong>Time:</strong> ${o.dateTime || 'Recent'}</p>
        <p><strong>Location:</strong> ${o.location}</p>
        <p><strong>Payment:</strong> ${o.paymentMethod || 'Cash'}</p>
      </div>
    </div>
  `).join('');
}

function renderHistory() {
  const container = document.getElementById('historyListContainer');
  if (completedHistory.length === 0) {
    container.innerHTML = `<p style="font-size:0.8rem; color:var(--text-sub);">No past orders logged yet.</p>`;
    return;
  }
  container.innerHTML = completedHistory.map(o => `
    <div class="order-card-track" style="opacity:0.85;">
      <div class="track-header">
        <span class="order-id">${o.id} - ${o.total.toLocaleString()} TZS</span>
        <span class="status-badge verified"><i class="fa-solid fa-check-double"></i> Confirmed</span>
      </div>
      <div class="track-details">
        <p><strong>Time:</strong> ${o.dateTime || 'Recent'}</p>
        <p><strong>Location:</strong> ${o.location}</p>
      </div>
    </div>
  `).join('');
}

function updateLoyaltyUI() {
  document.getElementById('loyaltyCountBadge').innerText = `${completedOrdersCount} / 5 Orders`;
  const stamps = document.querySelectorAll('.stamp-dot');
  stamps.forEach((stamp, idx) => {
    if (idx < completedOrdersCount) stamp.classList.add('filled');
    else stamp.classList.remove('filled');
  });
}

function sendCustomInquiry() {
  const val = document.getElementById('customInquiryInput').value.trim();
  if (!val) return;
  window.open(`https://wa.me/255764519027?text=${encodeURIComponent("Custom Inquiry from " + currentUsername + ": " + val)}`, '_blank');
  document.getElementById('customInquiryInput').value = '';
}

function triggerQuickReorder() { openHotMealsModal(); }

function igniteTeaserToast() {
  const toast = document.getElementById("soonToast");
  toast.classList.add("trigger-fly");
  setTimeout(() => toast.classList.remove("trigger-fly"), 3500);
}
