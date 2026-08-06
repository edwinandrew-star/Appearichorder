// APPEARICH — app screens, ordering flow, local+cloud order sync, install prompt

const App = (() => {
  const whatsappPhone = "255764519027";

  let completedOrdersCount = 0;
  let activeOrders = [];
  let completedHistory = [];
  let selectedPerfumeSize = "30ml (25,000/= TZS)";
  let animationLock = false;
  let calculatedSubtotal = 0;
  let calculatedSurcharge = 0;
  let calculatedGrandTotal = 0;
  let surchargePercent = 25;
  let selectedPaymentType = 'cash';
  let selectedFoodItems = [];

  // ---------------- called by auth.js once a user is signed in ----------------
  async function onLogin() {
    loadSavedUserLocation();
    renderSelectedItems();

    // Show cached orders instantly (offline-friendly), then refresh from Supabase.
    hydrateOrdersFromRows(DB.getCachedOrders());
    const rows = await DB.loadOrdersFromSupabase(currentUser.id);
    hydrateOrdersFromRows(rows);
  }

  function hydrateOrdersFromRows(rows) {
    if (!rows) return;
    activeOrders = rows.filter(r => r.status === 'pending' || r.status === 'verified').map(mapRowToUI);
    completedHistory = rows.filter(r => r.status === 'delivered').map(mapRowToUI);
    completedOrdersCount = completedHistory.length;
    updateLoyaltyUI();
    renderBookings();
    renderHistory();
  }

  function mapRowToUI(row) {
    const itemCount = Array.isArray(row.items) ? row.items.length : (row.items ? 1 : 0);
    const totalTxt = row.total ? `${Number(row.total).toLocaleString()} TZS` : '';
    return {
      id: row.id,
      supabaseId: row.id,
      title: row.order_type === 'meal'
        ? `${totalTxt} (${itemCount} items)`
        : `Perfume Order`,
      details: row.payment_method === 'cash'
        ? `Cash on Delivery${totalTxt ? ' | Total: ' + totalTxt : ''}`
        : `Paid by ${row.payer_name || '—'}${totalTxt ? ' | Total: ' + totalTxt : ''}`,
      location: row.location || '',
      status: row.status,
      timestamp: row.created_at
        ? new Date(row.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        : ''
    };
  }

  function loadSavedUserLocation() {
    const savedBlock = localStorage.getItem('appearich_user_block');
    const savedRoom = localStorage.getItem('appearich_user_room');
    if (savedBlock) document.getElementById('mealBlockLoc').value = savedBlock;
    if (savedRoom) document.getElementById('mealRoomLoc').value = savedRoom;
    if (savedBlock || savedRoom) {
      document.getElementById('locSavedTag').innerText = "(Auto-Filled)";
    }
  }

  function toggleTheme() {
    const currentTheme = document.documentElement.getAttribute('data-theme');
    const icon = document.querySelector('#themeToggleBtn i');
    if (currentTheme === 'dark') {
      document.documentElement.removeAttribute('data-theme');
      icon.className = 'fa-solid fa-moon';
      localStorage.setItem('appearich_theme', 'light');
    } else {
      document.documentElement.setAttribute('data-theme', 'dark');
      icon.className = 'fa-solid fa-sun';
      localStorage.setItem('appearich_theme', 'dark');
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
  function selectPerfumeSize(el, sizePrice) {
    document.querySelectorAll('#perfumesModal .price-card').forEach(c => c.classList.remove('active'));
    el.classList.add('active');
    selectedPerfumeSize = sizePrice;
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
    if (existing) {
      existing.qty += 1;
    } else {
      selectedFoodItems.push({ name: name, unitPrice: unitPrice, qty: 1 });
    }
    renderSelectedItems();
  }
  function updateItemQty(index, newQty) {
    const qty = parseInt(newQty) || 1;
    if (qty <= 0) {
      selectedFoodItems.splice(index, 1);
    } else {
      selectedFoodItems[index].qty = qty;
    }
    renderSelectedItems();
  }
  function removeItem(index) {
    selectedFoodItems.splice(index, 1);
    renderSelectedItems();
  }
  function renderSelectedItems() {
    const container = document.getElementById('selectedItemsContainer');
    if (selectedFoodItems.length === 0) {
      container.innerHTML = `<p style="font-size:0.8rem; color:var(--text-sub); text-align:center;">No items added yet. Click an item above to add to order.</p>`;
    } else {
      container.innerHTML = selectedFoodItems.map((item, index) => `
        <div class="selected-item-row">
          <div class="selected-item-info">
            ${item.name} (${item.unitPrice.toLocaleString()} TZS)
          </div>
          <div class="selected-item-ctrls">
            <label style="font-size:0.75rem; color:var(--text-sub);">Qty:</label>
            <input type="number" value="${item.qty}" min="1" onchange="App.updateItemQty(${index}, this.value)" onkeyup="App.updateItemQty(${index}, this.value)">
            <i class="fa-solid fa-trash" style="color:#e74c3c; cursor:pointer; font-size:0.9rem;" onclick="App.removeItem(${index})"></i>
          </div>
        </div>
      `).join('');
    }
    recalculateMealTotal();
  }
  function recalculateMealTotal() {
    calculatedSubtotal = selectedFoodItems.reduce((acc, item) => acc + (item.unitPrice * item.qty), 0);
    const currentHour = new Date().getHours();
    if (currentHour >= 23) {
      surchargePercent = 40;
      document.getElementById('nightBadgeSlot').innerHTML = `<span class="night-tag">Night Rate</span>`;
    } else {
      surchargePercent = 25;
      document.getElementById('nightBadgeSlot').innerHTML = '';
    }
    calculatedSurcharge = Math.round(calculatedSubtotal * (surchargePercent / 100));
    calculatedGrandTotal = calculatedSubtotal + calculatedSurcharge;
    document.getElementById('surchargeRateText').innerText = surchargePercent + "%";
    document.getElementById('displaySubtotal').innerText = calculatedSubtotal.toLocaleString() + " TZS";
    document.getElementById('displaySurcharge').innerText = calculatedSurcharge.toLocaleString() + " TZS";
    document.getElementById('displayGrandTotal').innerText = calculatedGrandTotal.toLocaleString() + " TZS";
  }

  async function submitFoodOrder() {
    if (selectedFoodItems.length === 0) {
      alert("Please select at least one item before placing your order!");
      return;
    }
    const details = document.getElementById('mealDetails').value.trim();
    const block = document.getElementById('mealBlockLoc').value.trim();
    const room = document.getElementById('mealRoomLoc').value.trim();
    const phone = document.getElementById('mealPhoneNum').value.trim();
    const payer = document.getElementById('payerName').value.trim();
    if (!block || !room) {
      alert("Please fill in both Block/Location and Room Number!");
      return;
    }
    if (!phone) {
      alert("Please provide a contact phone number!");
      return;
    }
    if (selectedPaymentType === 'mobile' && !payer) {
      alert("Tafadhali weka jina la namba iliyotumika kufanya malipo!");
      return;
    }
    localStorage.setItem('appearich_user_block', block);
    localStorage.setItem('appearich_user_room', room);

    const currentTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const orderId = "APR-" + Math.floor(1000 + Math.random() * 9000);
    const itemsSummaryText = selectedFoodItems.map(i => `${i.name} (${i.qty}x @ ${i.unitPrice.toLocaleString()} TZS)`).join("\n• ");
    let paymentDetailsMsg = selectedPaymentType === 'cash'
      ? `💵 *Payment Method:* Cash / Cash on Delivery`
      : `💳 *Payment Method:* Mobile Money (Lipa Namba 37247619 - Edwin Andrew)\n👤 *Jina la Namba iliyotumika:* ${payer}`;
    const whatsappText = `🍔 *NEW APPEARICH MEAL ORDER*\n` +
      `----------------------------------------\n` +
      `🆔 *Order ID:* ${orderId}\n` +
      `🍽️ *Selected Items:*\n• ${itemsSummaryText}\n\n` +
      `💵 *Subtotal:* ${calculatedSubtotal.toLocaleString()} TZS\n` +
      `⚡ *Service Fee (${surchargePercent}%):* ${calculatedSurcharge.toLocaleString()} TZS\n` +
      `💰 *TOTAL PAYABLE:* ${calculatedGrandTotal.toLocaleString()} TZS\n` +
      `----------------------------------------\n` +
      `📝 *Overall Description:* ${details || "None"}\n` +
      `📍 *Location:* ${block}, Room ${room}\n` +
      `📞 *Phone:* ${phone}\n` +
      `${paymentDetailsMsg}\n` +
      `⏰ *Time Placed:* ${currentTime}\n` +
      `----------------------------------------`;
    window.open(`https://wa.me/${whatsappPhone}?text=${encodeURIComponent(whatsappText)}`, '_blank');

    const newOrder = {
      id: orderId,
      title: `${calculatedGrandTotal.toLocaleString()} TZS (${selectedFoodItems.length} items)`,
      details: selectedPaymentType === 'cash' ? `Cash on Delivery | Total: ${calculatedGrandTotal.toLocaleString()} TZS` : `Paid by ${payer} | Total: ${calculatedGrandTotal.toLocaleString()} TZS`,
      location: `${block}, Room ${room}`,
      status: "pending",
      timestamp: currentTime
    };
    activeOrders.unshift(newOrder);
    selectedFoodItems = [];
    closeSheet('hotMealsModal');
    renderBookings();

    // Persist locally immediately, then push to Supabase (queued automatically if offline).
    const supabasePayload = {
      user_id: currentUser.id,
      order_type: 'meal',
      items: JSON.parse(JSON.stringify(selectedFoodItems.length ? selectedFoodItems : [])),
      subtotal: calculatedSubtotal,
      surcharge: calculatedSurcharge,
      total: calculatedGrandTotal,
      location: `${block}, Room ${room}`,
      phone: phone,
      payment_method: selectedPaymentType,
      payer_name: selectedPaymentType === 'mobile' ? payer : null,
      status: 'pending'
    };
    DB.saveOrderLocal({ ...supabasePayload, id: orderId, created_at: new Date().toISOString() });
    await DB.syncOrderToSupabase(supabasePayload);

    simulateVerification(newOrder.id);
  }

  async function submitPerfumeOrder() {
    const desc = document.getElementById('perfumeDesc').value.trim();
    if (!desc) {
      alert("Please enter a perfume name or describe the scent you want!");
      return;
    }
    const msg = encodeURIComponent(`Hi APPEARICH! I would like to place an order:\n\n- Preferred Size: ${selectedPerfumeSize}\n- Perfume Details: "${desc}"`);
    window.open(`https://wa.me/${whatsappPhone}?text=${msg}`, '_blank');
    closeSheet('perfumesModal');

    const supabasePayload = {
      user_id: currentUser.id,
      order_type: 'perfume',
      items: [{ size: selectedPerfumeSize, description: desc }],
      subtotal: null,
      surcharge: null,
      total: null,
      location: null,
      phone: currentUser.phone || null,
      payment_method: 'cash',
      payer_name: null,
      status: 'pending'
    };
    DB.saveOrderLocal({ ...supabasePayload, id: 'local-' + Date.now(), created_at: new Date().toISOString() });
    await DB.syncOrderToSupabase(supabasePayload);
  }

  function simulateVerification(orderId) {
    setTimeout(() => {
      const orderIdx = activeOrders.findIndex(o => o.id === orderId);
      if (orderIdx !== -1) {
        activeOrders[orderIdx].status = "verified";
        renderBookings();
        setTimeout(() => {
          const verifiedItem = activeOrders.splice(orderIdx, 1)[0];
          completedHistory.unshift(verifiedItem);
          completedOrdersCount++;
          updateLoyaltyUI();
          renderBookings();
          renderHistory();
        }, 3000);
      }
    }, 3500);
  }

  function renderBookings() {
    const container = document.getElementById('bookingsListContainer');
    if (activeOrders.length === 0) {
      container.innerHTML = `
        <div style="text-align:center; padding:40px 20px; color:var(--text-sub);">
          <i class="fa-solid fa-box-open" style="font-size:2.5rem; margin-bottom:10px;"></i>
          <p style="font-size:0.85rem;">No active orders pending right now.</p>
        </div>
      `;
      return;
    }
    container.innerHTML = activeOrders.map(o => `
      <div class="order-card-track">
        <div class="track-header">
          <span class="order-id">${o.id} - ${o.title}</span>
          ${o.status === 'pending'
            ? `<span class="status-badge pending"><i class="fa-solid fa-clock"></i> Pending</span>`
            : `<span class="status-badge verified"><i class="fa-solid fa-circle-check"></i> Verified</span>`}
        </div>
        <div class="track-details">
          <p><strong>Payment Info:</strong> ${o.details}</p>
          <p><strong>Location:</strong> ${o.location}</p>
          <p style="font-size:0.75rem; color:var(--text-sub); margin-top:4px;">Placed at: ${o.timestamp}</p>
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
          <span class="order-id">${o.id} - ${o.title}</span>
          <span class="status-badge verified"><i class="fa-solid fa-check-double"></i> Delivered</span>
        </div>
        <div class="track-details">
          <p style="font-size:0.8rem;">${o.details}</p>
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
    const msg = encodeURIComponent(`Hi APPEARICH! Custom Inquiry: "${val}"`);
    window.open(`https://wa.me/${whatsappPhone}?text=${msg}`, '_blank');
    document.getElementById('customInquiryInput').value = '';
  }
  function triggerQuickReorder() { openHotMealsModal(); }
  function igniteTeaserToast() {
    if (animationLock) return;
    animationLock = true;
    const toast = document.getElementById("soonToast");
    toast.classList.add("trigger-fly");
    setTimeout(() => {
      toast.classList.remove("trigger-fly");
      animationLock = false;
    }, 3500);
  }

  // Restore saved theme preference on boot.
  (function restoreTheme() {
    if (localStorage.getItem('appearich_theme') === 'dark') {
      document.documentElement.setAttribute('data-theme', 'dark');
      window.addEventListener('DOMContentLoaded', () => {
        const icon = document.querySelector('#themeToggleBtn i');
        if (icon) icon.className = 'fa-solid fa-sun';
      });
    }
  })();

  return {
    onLogin,
    toggleTheme, switchTab, goBack,
    openHotMealsModal, openOrderModal, closeSheet, openProductModal,
    selectPerfumeSize, selectPaymentMethod,
    addItemToOrder, updateItemQty, removeItem,
    submitFoodOrder, submitPerfumeOrder,
    sendCustomInquiry, triggerQuickReorder, igniteTeaserToast
  };
})();

// ---------------- Install prompt (Android / desktop Chrome & Edge) ----------------
let deferredInstallPrompt = null;
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredInstallPrompt = e;
  if (!localStorage.getItem('appearich_install_dismissed')) {
    document.getElementById('installBanner').classList.add('visible');
  }
});
function handleInstallClick() {
  const banner = document.getElementById('installBanner');
  banner.classList.remove('visible');
  if (!deferredInstallPrompt) return;
  deferredInstallPrompt.prompt();
  deferredInstallPrompt.userChoice.finally(() => { deferredInstallPrompt = null; });
}
function dismissInstallBanner() {
  document.getElementById('installBanner').classList.remove('visible');
  localStorage.setItem('appearich_install_dismissed', '1');
}

// ---------------- Register service worker ----------------
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/service-worker.js').catch((err) => {
      console.warn('Service worker registration failed:', err);
    });
  });
}
