// APPEARICH — local-first data layer
// Everything is written to localStorage immediately (so the app works offline
// and survives refreshes), then pushed to Supabase. If the push fails
// (offline / error) it's queued and retried automatically on the next
// 'online' event.

const DB = (() => {
  const LS_PROFILE = 'appearich_profile_cache';
  const LS_ORDERS = 'appearich_orders_cache';
  const LS_QUEUE = 'appearich_sync_queue';

  function readJSON(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (e) {
      return fallback;
    }
  }

  function writeJSON(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (e) {
      console.warn('DB: failed to write', key, e);
    }
  }

  // ---------------- Profile cache ----------------
  function cacheProfile(profile) {
    writeJSON(LS_PROFILE, profile);
  }
  function getCachedProfile() {
    return readJSON(LS_PROFILE, null);
  }
  function clearProfile() {
    localStorage.removeItem(LS_PROFILE);
  }

  // ---------------- Orders cache ----------------
  function getCachedOrders() {
    return readJSON(LS_ORDERS, []);
  }
  function saveOrderLocal(order) {
    const orders = getCachedOrders();
    orders.unshift(order);
    writeJSON(LS_ORDERS, orders);
    return order;
  }
  function updateOrderLocal(localId, patch) {
    const orders = getCachedOrders();
    const idx = orders.findIndex((o) => o.localId === localId);
    if (idx !== -1) {
      orders[idx] = { ...orders[idx], ...patch };
      writeJSON(LS_ORDERS, orders);
    }
  }
  function replaceOrdersCache(orders) {
    writeJSON(LS_ORDERS, orders);
  }

  // ---------------- Offline sync queue ----------------
  function getQueue() {
    return readJSON(LS_QUEUE, []);
  }
  function queueWrite(task) {
    const queue = getQueue();
    queue.push(task);
    writeJSON(LS_QUEUE, queue);
  }
  function clearQueueItem(index) {
    const queue = getQueue();
    queue.splice(index, 1);
    writeJSON(LS_QUEUE, queue);
  }

  async function flushQueue() {
    if (!navigator.onLine) return;
    const queue = getQueue();
    if (queue.length === 0) return;
    // Process sequentially, removing successful items as we go.
    for (let i = queue.length - 1; i >= 0; i--) {
      const task = queue[i];
      try {
        if (task.type === 'insert_order') {
          await supabaseClient.from('orders').insert(task.payload);
        } else if (task.type === 'update_profile') {
          await supabaseClient.from('profiles').update(task.payload).eq('id', task.userId);
        }
        clearQueueItem(i);
      } catch (e) {
        // leave it queued, try again next time
        console.warn('DB: sync retry failed for', task.type, e);
      }
    }
  }

  // ---------------- Supabase-backed operations ----------------
  async function syncOrderToSupabase(order) {
    const payload = {
      user_id: order.user_id,
      order_type: order.order_type,
      items: order.items,
      subtotal: order.subtotal,
      surcharge: order.surcharge,
      total: order.total,
      location: order.location,
      phone: order.phone,
      payment_method: order.payment_method,
      payer_name: order.payer_name || null,
      status: order.status || 'pending'
    };
    try {
      const { error } = await supabaseClient.from('orders').insert(payload);
      if (error) throw error;
    } catch (e) {
      queueWrite({ type: 'insert_order', payload });
    }
  }

  async function loadOrdersFromSupabase(userId) {
    try {
      const { data, error } = await supabaseClient
        .from('orders')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      if (data) replaceOrdersCache(data);
      return data || getCachedOrders();
    } catch (e) {
      // offline or error — fall back to whatever's cached locally
      return getCachedOrders();
    }
  }

  async function fetchProfile(userId) {
    try {
      const { data, error } = await supabaseClient
        .from('profiles')
        .select('id, full_name, phone')
        .eq('id', userId)
        .single();
      if (error) throw error;
      if (data) cacheProfile(data);
      return data || getCachedProfile();
    } catch (e) {
      return getCachedProfile();
    }
  }

  // Retry queued writes whenever the browser regains connectivity.
  window.addEventListener('online', flushQueue);

  return {
    cacheProfile,
    getCachedProfile,
    clearProfile,
    getCachedOrders,
    saveOrderLocal,
    updateOrderLocal,
    replaceOrdersCache,
    queueWrite,
    flushQueue,
    syncOrderToSupabase,
    loadOrdersFromSupabase,
    fetchProfile
  };
})();
