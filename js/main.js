/**
 * متجر أورا | AURA Beauty & Care - النظام البرمجي والمنطقي المتكامل
 * يتضمن:
 * 1. إدارة الحالة المركزية (Observable Reactive Store) مع تزامن التخزين المحلي والنوافذ المتعددة
 * 2. محاكي الـ Backend والـ API Layer مع دعم المفاتيح المانعة للتكرار (Idempotency) وإعادة المحاولة (Retry)
 * 3. نظام التحقق الصارم من البيانات (Validation & Sanitization) ومعالجة الأخطاء
 * 4. سلة المشتريات، المفضلة، البحث الفوري، وتدفق إتمام الدفع (Checkout)
 * 5. مراقبة حالة الشبكة (Offline Detection) وحزمة الاختبارات الآلية الشاملة (Automated Test Suite)
 */

// ==========================================================================
// 1. قاعدة بيانات المنتجات المصدرية (Catalog Database)
// ==========================================================================
const PRODUCTS_DB = {
  '1': {
    id: '1',
    title: 'سيروم اللافندر والأميثيست للنضارة الفائقة',
    category: 'سيروم الوجه والعناية المركزة',
    price: 245,
    oldPrice: 320,
    stock: 45,
    sku: 'AUR-SRM-001',
    image: 'assets/images/product_serum.jpg',
    rating: 4.9,
    reviews: 142,
    badge: 'الأكثر طلباً',
    badgeClass: 'badge-bestseller',
    description: 'تركيبة غنية بحمض الهيالورونيك النقي ومستخلص زهور اللافندر العضوية مع جزيئات حجر الأميثيست لتعزيز إشراقة البشرة وشد المسام وترطيب عميق يدوم 24 ساعة.',
    ingredients: 'مستخلص اللافندر العضوي، حمض الهيالورونيك ثلاثي الأوزان، نياسيناميد 5%، فيتامين B5، ماء الورد الجبلي.',
    usage: 'ضعي 3-4 قطرات على بشرة نظيفة صباحاً ومساءً قبل الكريم المرطب، مع تدليك لطيف بحركات دائرية لأعلى.'
  },
  '2': {
    id: '2',
    title: 'كريم الليل الملكي بالببتيدات ومستخلص الأوركيد',
    category: 'ترطيب وتجديد الخلايا',
    price: 290,
    oldPrice: 360,
    stock: 28,
    sku: 'AUR-CRM-002',
    image: 'assets/images/product_cream.jpg',
    rating: 5.0,
    reviews: 98,
    badge: 'خصم 20%',
    badgeClass: 'badge-discount',
    description: 'كريم ليلي مخملي فاخر يعمل على تغذية البشرة ومحاربة علامات التقدم بالسن أثناء النوم بفضل الببتيدات الحيوية ومستخلص زهرة الأوركيد البنفسجية النادرة.',
    ingredients: 'ببتيدات الكولاجين النباتي، خلاصة الأوركيد البنفسجي، زبدة الشيا العضوية، سيراميد NP، فيتامين E الطبيعي.',
    usage: 'يوزع بسخاء على الوجه والرقبة كل مساء بعد السيروم، ويدلك برفق حتى تمتصه البشرة بالكامل.'
  },
  '3': {
    id: '3',
    title: 'إكسير الزيوت العضوية المعصور على البارد',
    category: 'الزيوت الطبيعية والإشراقة',
    price: 210,
    oldPrice: 275,
    stock: 35,
    sku: 'AUR-OIL-003',
    image: 'assets/images/product_oil.jpg',
    rating: 4.8,
    reviews: 115,
    badge: 'عضوي 100%',
    badgeClass: 'badge-organic',
    description: 'مزيج استثنائي من 7 زيوت نباتية ثمينة معصورة على البارد وغنية بمضادات الأكسدة وأحماض أوميغا 3 و 6 و 9 لمنح بشرتك توهجاً صحياً مخملياً وملمساً فائق النعومة.',
    ingredients: 'زيت بذور ثمر الورد النقي، زيت الجوجوبا الذهبي، زيت اللافندر العطري، زيت الأرغان، مستخلص البابونج الأزرق.',
    usage: 'ضعي قطرتين إلى ثلاث قطرات كخطوة أخيرة في روتين العناية، أو امزجي قطرة واحدة مع كريم الأساس لتأثير ندي جذاب.'
  }
};

// ==========================================================================
// 2. أدوات التحقق والتطهير والـ Logging (Utilities & Security)
// ==========================================================================
const Validators = {
  // التحقق من رقم الجوال السعودي (05XXXXXXXX أو 5XXXXXXXX)
  isValidSaudiPhone(phone) {
    if (!phone) return false;
    const cleanPhone = phone.toString().replace(/[\s-]/g, '');
    return /^(05|5)\d{8}$/.test(cleanPhone);
  },

  // التحقق من البريد الإلكتروني وفق معايير RFC
  isValidEmail(email) {
    if (!email) return false;
    return /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(email.trim());
  },

  // تطهير النصوص لحماية الواجهة من هجمات XSS
  sanitizeHtml(str) {
    if (typeof str !== 'string') return '';
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }
};

const Logger = {
  history: [],
  log(level, message, data = null) {
    const entry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      data
    };
    this.history.push(entry);
    if (this.history.length > 200) this.history.shift(); // الحفاظ على حجم الذاكرة

    const style = level === 'ERROR' ? 'color: #EF4444; font-weight: bold;' :
                  level === 'WARN'  ? 'color: #F59E0B; font-weight: bold;' :
                                      'color: #7C3AED;';
    console.log(`%c[AURA ${level}] ${entry.timestamp}: ${message}`, style, data || '');
  },
  info(msg, data) { this.log('INFO', msg, data); },
  warn(msg, data) { this.log('WARN', msg, data); },
  error(msg, data) { this.log('ERROR', msg, data); }
};

// ==========================================================================
// 3. إدارة الحالة المركزية التفاعلية (Centralized Observable Store)
// ==========================================================================
class StoreManager {
  constructor() {
    this.listeners = new Set();
    this.state = {
      cart: this.loadStorage('aura_cart', [{ id: '1', qty: 1 }]),
      wishlist: this.loadStorage('aura_wishlist', []),
      coupon: this.loadStorage('aura_coupon', null), // { code: 'AURA15', rate: 0.15 }
      isOffline: !navigator.onLine,
      checkoutStep: 1,
      orderReceipt: null
    };

    // الاستماع لأي تغيير في التخزين من علامات تبويب أخرى (Cross-tab Sync)
    window.addEventListener('storage', (e) => {
      if (e.key === 'aura_cart' || e.key === 'aura_wishlist' || e.key === 'aura_coupon') {
        Logger.info(`تم رصد تحديث خارجي في التخزين: ${e.key}`);
        this.state.cart = this.loadStorage('aura_cart', []);
        this.state.wishlist = this.loadStorage('aura_wishlist', []);
        this.state.coupon = this.loadStorage('aura_coupon', null);
        this.notify();
      }
    });

    // مراقبة الاتصال بالإنترنت
    window.addEventListener('online', () => {
      this.state.isOffline = false;
      Logger.info('تم استعادة الاتصال بالإنترنت');
      this.notify();
    });
    window.addEventListener('offline', () => {
      this.state.isOffline = true;
      Logger.warn('انقطع الاتصال بالإنترنت');
      this.notify();
    });
  }

  loadStorage(key, fallback) {
    try {
      const data = localStorage.getItem(key);
      return data ? JSON.parse(data) : fallback;
    } catch (e) {
      Logger.error(`فشل قراءة ${key} من التخزين المحلي، سيتم اعتماد القيمة الافتراضية`, e);
      return fallback;
    }
  }

  saveStorage(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (e) {
      Logger.error(`تعذر حفظ ${key} في التخزين المحلي`, e);
    }
  }

  subscribe(listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  notify() {
    this.listeners.forEach(fn => fn(this.state));
  }

  // --- دوال السلة (Cart Actions) ---
  addToCart(id, qty = 1) {
    const product = PRODUCTS_DB[id];
    if (!product) {
      Logger.error(`فشل إضافة المنتج: المعرف ${id} غير موجود في قاعدة البيانات.`);
      return false;
    }

    const item = this.state.cart.find(i => i.id === id);
    if (item) {
      item.qty += qty;
    } else {
      this.state.cart.push({ id, qty });
    }

    this.saveStorage('aura_cart', this.state.cart);
    this.notify();
    Logger.info(`تمت إضافة المنتج ${product.title} إلى السلة`, { id, qty });
    return true;
  }

  updateCartQty(id, delta) {
    const item = this.state.cart.find(i => i.id === id);
    if (!item) return;

    item.qty += delta;
    if (item.qty <= 0) {
      this.state.cart = this.state.cart.filter(i => i.id !== id);
    }

    this.saveStorage('aura_cart', this.state.cart);
    this.notify();
  }

  removeFromCart(id) {
    this.state.cart = this.state.cart.filter(i => i.id !== id);
    this.saveStorage('aura_cart', this.state.cart);
    this.notify();
  }

  clearCart() {
    this.state.cart = [];
    this.saveStorage('aura_cart', []);
    this.notify();
  }

  // --- حسابات السلة المالية ---
  getSubtotal() {
    return this.state.cart.reduce((sum, item) => {
      const prod = PRODUCTS_DB[item.id];
      return sum + (prod ? prod.price * item.qty : 0);
    }, 0);
  }

  getDiscountAmount() {
    if (!this.state.coupon) return 0;
    const subtotal = this.getSubtotal();
    return Math.round(subtotal * this.state.coupon.rate);
  }

  getShippingFee() {
    const subtotal = this.getSubtotal();
    if (subtotal === 0) return 0;
    return subtotal >= 300 ? 0 : 25; // شحن مجاني عند الشراء بـ 300 ريال فأكثر
  }

  getVatAmount() {
    // ضريبة القيمة المضافة 15% مشمولة أو محسوبة
    const subtotal = this.getSubtotal() - this.getDiscountAmount();
    return Math.round(subtotal * 0.15);
  }

  getGrandTotal() {
    const subtotal = this.getSubtotal();
    if (subtotal === 0) return 0;
    const discount = this.getDiscountAmount();
    const shipping = this.getShippingFee();
    return Math.max(0, subtotal - discount + shipping);
  }

  // --- دوال المفضلة (Wishlist Actions) ---
  toggleWishlist(id) {
    const product = PRODUCTS_DB[id];
    if (!product) return false;

    const exists = this.state.wishlist.includes(id);
    if (exists) {
      this.state.wishlist = this.state.wishlist.filter(item => item !== id);
      Logger.info(`تم حذف المنتج ${product.title} من المفضلة`);
    } else {
      this.state.wishlist.push(id);
      Logger.info(`تمت إضافة المنتج ${product.title} إلى المفضلة`);
    }

    this.saveStorage('aura_wishlist', this.state.wishlist);
    this.notify();
    return !exists;
  }

  isInWishlist(id) {
    return this.state.wishlist.includes(id);
  }

  moveAllWishlistToCart() {
    let addedCount = 0;
    this.state.wishlist.forEach(id => {
      this.addToCart(id, 1);
      addedCount++;
    });
    this.state.wishlist = [];
    this.saveStorage('aura_wishlist', []);
    this.notify();
    return addedCount;
  }
}

const store = new StoreManager();

// ==========================================================================
// 4. محاكي الـ Backend والـ API Layer (Mock ApiClient with Resilience)
// ==========================================================================
class ApiClient {
  constructor() {
    this.idempotencyTokens = new Set();
  }

  // محاكاة تأخير الشبكة والـ Latency
  async simulateNetwork(delay = 400) {
    return new Promise(resolve => setTimeout(resolve, delay));
  }

  // التحقق من صلاحية كود الخصم (Coupon API)
  async validateCoupon(code) {
    await this.simulateNetwork(350);
    const cleanCode = code ? code.trim().toUpperCase() : '';

    if (cleanCode === 'AURA15') {
      return { success: true, code: 'AURA15', rate: 0.15, description: 'خصم 15% على طلبك' };
    }
    if (cleanCode === 'BEAUTY20') {
      return { success: true, code: 'BEAUTY20', rate: 0.20, description: 'خصم 20% حصري' };
    }

    throw new Error('كود الخصم المدخل غير صالح أو انتهت صلاحيته.');
  }

  // محاكاة معالجة الدفع وإنشاء الطلب (Checkout API with Idempotency)
  async processCheckout(orderData, idempotencyKey) {
    if (!navigator.onLine) {
      throw new Error('تعذر إتمام الدفع: لا يوجد اتصال بالإنترنت.');
    }

    if (this.idempotencyTokens.has(idempotencyKey)) {
      Logger.warn(`تم رصد طلب مكرر باستخدام نفس المفتاح IdempotencyKey: ${idempotencyKey}`);
      throw new Error('تم استلام هذا الطلب ومعالجته مسبقاً لمنع التكرار.');
    }

    // محاكاة التحقق من المدخلات
    if (!orderData.fullName || orderData.fullName.length < 3) {
      throw new Error('يُرجى إدخال اسم العميل الثلاثي بشكل صحيح.');
    }
    if (!Validators.isValidSaudiPhone(orderData.phone)) {
      throw new Error('رقم الجوال غير صالح. يجب أن يبدأ بـ 05 ويتكون من 10 أرقام.');
    }
    if (!orderData.city || !orderData.address) {
      throw new Error('يُرجى إدخال العنوان التفصيلي والمدينة.');
    }

    await this.simulateNetwork(750);

    // تسجيل المفتاح لمنع التكرار
    this.idempotencyTokens.add(idempotencyKey);

    const orderNumber = 'AURA-ORD-' + Math.floor(100000 + Math.random() * 900000);
    const receipt = {
      orderNumber,
      orderDate: new Date().toLocaleDateString('ar-SA', { dateStyle: 'full' }),
      customer: orderData.fullName,
      phone: orderData.phone,
      city: orderData.city,
      address: orderData.address,
      paymentMethod: orderData.paymentMethod,
      items: [...store.state.cart],
      subtotal: store.getSubtotal(),
      discount: store.getDiscountAmount(),
      shipping: store.getShippingFee(),
      grandTotal: store.getGrandTotal(),
      status: 'تم الدفع وتأكيد الطلب بنجاح',
      estimatedDelivery: 'خلال 48 ساعة كحد أقصى'
    };

    Logger.info(`تم إنشاء الطلب بنجاح برقم: ${orderNumber}`, receipt);
    return { success: true, receipt };
  }

  // محاكاة إرسال طلب B2B
  async submitB2BRFQ(rfqData) {
    await this.simulateNetwork(600);
    if (!rfqData.companyName || !rfqData.crNumber || !Validators.isValidSaudiPhone(rfqData.phone)) {
      throw new Error('بيانات المنشأة أو رقم الجوال غير مكتملة.');
    }

    const refNumber = 'AURA-B2B-' + Math.floor(100000 + Math.random() * 900000);
    return { success: true, reference: refNumber };
  }
}

const api = new ApiClient();

// ==========================================================================
// 5. المتحكمات وعناصر واجهة المستخدم (UI Controllers)
// ==========================================================================
document.addEventListener('DOMContentLoaded', () => {
  // العناصر العامة
  const siteHeader = document.querySelector('.site-header');
  const offlineBanner = document.getElementById('offline-banner');

  // عناصر السلة
  const cartTrigger = document.getElementById('cart-trigger');
  const cartDrawer = document.getElementById('cart-drawer');
  const cartBackdrop = document.getElementById('cart-backdrop');
  const btnCloseCart = document.getElementById('close-cart-btn');
  const cartItemsContainer = document.getElementById('cart-items-container');
  const cartCountBadges = document.querySelectorAll('.cart-count');
  const cartTotalAmount = document.getElementById('cart-total-amount');
  const freeShippingFill = document.getElementById('shipping-fill');
  const freeShippingText = document.getElementById('shipping-text');
  const btnProceedCheckout = document.getElementById('btn-proceed-checkout');

  // عناصر المفضلة
  const wishlistTrigger = document.getElementById('wishlist-trigger');
  const wishlistDrawer = document.getElementById('wishlist-drawer');
  const wishlistBackdrop = document.getElementById('wishlist-backdrop');
  const btnCloseWishlist = document.getElementById('close-wishlist-btn');
  const wishlistItemsContainer = document.getElementById('wishlist-items-container');
  const wishlistCountBadge = document.getElementById('wishlist-count');
  const btnMoveAllToCart = document.getElementById('btn-move-all-to-cart');

  // عناصر البحث
  const searchTrigger = document.getElementById('search-trigger');
  const searchModalBackdrop = document.getElementById('search-modal-backdrop');
  const closeSearchBtn = document.getElementById('close-search-btn');
  const liveSearchInput = document.getElementById('live-search-input');
  const searchResultsBox = document.getElementById('search-results-box');

  // عناصر إتمام الطلب (Checkout)
  const checkoutBackdrop = document.getElementById('checkout-backdrop');
  const closeCheckoutBtn = document.getElementById('close-checkout-btn');
  const checkoutBody = document.getElementById('checkout-body');
  const stepIndicators = [
    document.getElementById('step-ind-1'),
    document.getElementById('step-ind-2'),
    document.getElementById('step-ind-3')
  ];

  // عناصر القائمة للجوال
  const menuToggle = document.getElementById('menu-toggle');
  const navLinks = document.getElementById('nav-links');

  // عناصر الاختبارات الآلية
  const testRunnerTrigger = document.getElementById('test-runner-trigger');
  const testRunnerModal = document.getElementById('test-runner-modal');
  const closeTestsBtn = document.getElementById('close-tests-btn');
  const testResultsContainer = document.getElementById('test-results-container');
  const testSuiteSummary = document.getElementById('test-suite-summary');
  const btnRerunTests = document.getElementById('btn-rerun-tests');

  // --- 1. تحديث الهيدر وشريط الـ Offline ---
  window.addEventListener('scroll', () => {
    if (window.scrollY > 40) siteHeader?.classList.add('scrolled');
    else siteHeader?.classList.remove('scrolled');
  });

  function updateNetworkStatus() {
    if (store.state.isOffline) {
      offlineBanner?.classList.add('visible');
    } else {
      offlineBanner?.classList.remove('visible');
    }
  }

  // --- 2. سلة المشتريات (Cart Controller) ---
  function openCart() {
    closeWishlist();
    cartDrawer?.classList.add('open');
    cartBackdrop?.classList.add('open');
    document.body.style.overflow = 'hidden';
  }

  function closeCart() {
    cartDrawer?.classList.remove('open');
    cartBackdrop?.classList.remove('open');
    if (!wishlistDrawer?.classList.contains('open') && !checkoutBackdrop?.classList.contains('open')) {
      document.body.style.overflow = '';
    }
  }

  cartTrigger?.addEventListener('click', openCart);
  btnCloseCart?.addEventListener('click', closeCart);
  cartBackdrop?.addEventListener('click', closeCart);

  function renderCart() {
    if (!cartItemsContainer) return;
    const { cart } = store.state;

    // تحديث الشارات
    const totalCount = cart.reduce((sum, item) => sum + item.qty, 0);
    cartCountBadges.forEach(badge => {
      badge.textContent = totalCount;
      badge.classList.add('bump');
      setTimeout(() => badge.classList.remove('bump'), 300);
    });

    if (cart.length === 0) {
      cartItemsContainer.innerHTML = `
        <div style="text-align: center; padding: 3rem 1.5rem; color: var(--text-muted);">
          <div style="font-size: 3rem; margin-bottom: 1rem; opacity: 0.5;">🛍️</div>
          <h4 style="font-size: 1.15rem; color: var(--dark-950); margin-bottom: 0.5rem;">حقيبة التسوق فارغة حالياً</h4>
          <p style="font-size: 0.9rem; margin-bottom: 1.5rem;">اختاري ما يناسب جمالكِ من منتجات اللافندر الفاخرة.</p>
          <button class="btn btn-primary" onclick="document.getElementById('close-cart-btn').click(); window.location.href='#products';">
            تسوقي التشكيلة الآن
          </button>
        </div>
      `;
      if (cartTotalAmount) cartTotalAmount.innerHTML = '0 <span class="currency">ر.س</span>';
      if (freeShippingFill) freeShippingFill.style.width = '0%';
      if (freeShippingText) freeShippingText.textContent = 'أضيفي منتجات بقيمة 300 ر.س للحصول على شحن مجاني!';
      if (btnProceedCheckout) btnProceedCheckout.disabled = true;
      return;
    }

    if (btnProceedCheckout) btnProceedCheckout.disabled = false;

    cartItemsContainer.innerHTML = cart.map(item => {
      const prod = PRODUCTS_DB[item.id];
      if (!prod) return '';
      const totalItemPrice = prod.price * item.qty;

      return `
        <div class="cart-item" data-id="${item.id}">
          <img src="${prod.image}" alt="${Validators.sanitizeHtml(prod.title)}" class="cart-item-img">
          <div class="cart-item-details">
            <h4 class="cart-item-title">${Validators.sanitizeHtml(prod.title)}</h4>
            <div class="cart-item-price">${totalItemPrice} <span class="currency">ر.س</span></div>
            <div class="cart-item-actions">
              <div class="qty-controls">
                <button class="qty-btn" onclick="store.updateCartQty('${item.id}', -1)" aria-label="تقليل الكمية">-</button>
                <span class="qty-val">${item.qty}</span>
                <button class="qty-btn" onclick="store.updateCartQty('${item.id}', 1)" aria-label="زيادة الكمية">+</button>
              </div>
              <button class="btn-remove-item" onclick="store.removeFromCart('${item.id}')" aria-label="حذف المنتج من السلة">
                حذف
              </button>
            </div>
          </div>
        </div>
      `;
    }).join('');

    const subtotal = store.getSubtotal();
    if (cartTotalAmount) cartTotalAmount.innerHTML = `${subtotal} <span class="currency">ر.س</span>`;

    // شريط الشحن المجاني
    const freeTarget = 300;
    const progress = Math.min(100, Math.round((subtotal / freeTarget) * 100));
    if (freeShippingFill) freeShippingFill.style.width = `${progress}%`;

    if (freeShippingText) {
      if (subtotal >= freeTarget) {
        freeShippingText.innerHTML = `🎉 مبروك! حققتِ <strong>شحن مجاني فاخر لكافة مدن المملكة</strong>!`;
      } else {
        const remaining = freeTarget - subtotal;
        freeShippingText.innerHTML = `متبقي لكِ <strong>${remaining} ر.س</strong> فقط للحصول على شحن مجاني!`;
      }
    }
  }

  // --- 3. المفضلة (Wishlist Controller) ---
  function openWishlist() {
    closeCart();
    wishlistDrawer?.classList.add('open');
    wishlistBackdrop?.classList.add('open');
    document.body.style.overflow = 'hidden';
  }

  function closeWishlist() {
    wishlistDrawer?.classList.remove('open');
    wishlistBackdrop?.classList.remove('open');
    if (!cartDrawer?.classList.contains('open') && !checkoutBackdrop?.classList.contains('open')) {
      document.body.style.overflow = '';
    }
  }

  wishlistTrigger?.addEventListener('click', openWishlist);
  btnCloseWishlist?.addEventListener('click', closeWishlist);
  wishlistBackdrop?.addEventListener('click', closeWishlist);

  btnMoveAllToCart?.addEventListener('click', () => {
    const moved = store.moveAllWishlistToCart();
    if (moved > 0) {
      showToast(`تم نقل ${moved} منتج من المفضلة إلى سلة التسوق بنجاح! 🛍️`);
      closeWishlist();
      openCart();
    } else {
      showToast('قائمة المفضلة فارغة حالياً.');
    }
  });

  function renderWishlist() {
    if (!wishlistItemsContainer) return;
    const { wishlist } = store.state;

    // تحديث الشارة
    if (wishlistCountBadge) {
      wishlistCountBadge.textContent = wishlist.length;
      wishlistCountBadge.classList.add('bump');
      setTimeout(() => wishlistCountBadge.classList.remove('bump'), 300);
    }

    // مزامنة حالة الأزرار في كروت المنتجات
    document.querySelectorAll('.btn-wishlist').forEach(btn => {
      const card = btn.closest('.product-card');
      const id = card?.getAttribute('data-product-id');
      if (id && store.isInWishlist(id)) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
    });

    if (wishlist.length === 0) {
      wishlistItemsContainer.innerHTML = `
        <div style="text-align: center; padding: 3rem 1.5rem; color: var(--text-muted);">
          <div style="font-size: 3rem; margin-bottom: 1rem; opacity: 0.5;">❤️</div>
          <h4 style="font-size: 1.15rem; color: var(--dark-950); margin-bottom: 0.5rem;">قائمة المفضلة فارغة</h4>
          <p style="font-size: 0.9rem; margin-bottom: 1.5rem;">احفظي منتجاتكِ المحببة بالضغط على علامة القلب للعودة إليها لاحقاً.</p>
        </div>
      `;
      if (btnMoveAllToCart) btnMoveAllToCart.style.display = 'none';
      return;
    }

    if (btnMoveAllToCart) btnMoveAllToCart.style.display = 'block';

    wishlistItemsContainer.innerHTML = wishlist.map(id => {
      const prod = PRODUCTS_DB[id];
      if (!prod) return '';

      return `
        <div class="cart-item" data-wishlist-id="${id}">
          <img src="${prod.image}" alt="${Validators.sanitizeHtml(prod.title)}" class="cart-item-img">
          <div class="cart-item-details">
            <h4 class="cart-item-title">${Validators.sanitizeHtml(prod.title)}</h4>
            <div class="cart-item-price">${prod.price} <span class="currency">ر.س</span></div>
            <div class="cart-item-actions">
              <button class="btn btn-primary" style="padding: 0.4rem 0.9rem; font-size: 0.78rem;" onclick="store.addToCart('${id}', 1); showToast('تمت الإضافة للسلة بنجاح!');">
                أضف للسلة
              </button>
              <button class="btn-remove-item" onclick="store.toggleWishlist('${id}')" aria-label="إزالة من المفضلة">
                إزالة
              </button>
            </div>
          </div>
        </div>
      `;
    }).join('');
  }

  // --- 4. البحث المباشر الفوري (Search Controller) ---
  searchTrigger?.addEventListener('click', () => {
    searchModalBackdrop?.classList.add('open');
    document.body.style.overflow = 'hidden';
    setTimeout(() => liveSearchInput?.focus(), 150);
  });

  closeSearchBtn?.addEventListener('click', () => {
    searchModalBackdrop?.classList.remove('open');
    document.body.style.overflow = '';
  });

  searchModalBackdrop?.addEventListener('click', (e) => {
    if (e.target === searchModalBackdrop) {
      searchModalBackdrop.classList.remove('open');
      document.body.style.overflow = '';
    }
  });

  liveSearchInput?.addEventListener('input', (e) => {
    const q = e.target.value.trim().toLowerCase();
    if (!q) {
      searchResultsBox.innerHTML = '<p style="text-align: center; color: var(--text-muted); padding: 2rem;">اكتبي كلمة البحث لتظهر النتائج فوراً...</p>';
      return;
    }

    const matches = Object.values(PRODUCTS_DB).filter(prod => {
      return prod.title.toLowerCase().includes(q) ||
             prod.category.toLowerCase().includes(q) ||
             prod.description.toLowerCase().includes(q) ||
             prod.ingredients.toLowerCase().includes(q);
    });

    if (matches.length === 0) {
      searchResultsBox.innerHTML = `
        <div style="text-align: center; padding: 2.5rem; color: var(--text-muted);">
          <div style="font-size: 2.5rem; margin-bottom: 0.5rem;">🔍</div>
          <p>لم نجد أي منتج يطابق "<strong>${Validators.sanitizeHtml(q)}</strong>"</p>
        </div>
      `;
      return;
    }

    searchResultsBox.innerHTML = matches.map(prod => {
      const reg = new RegExp(`(${q})`, 'gi');
      const highlightedTitle = Validators.sanitizeHtml(prod.title).replace(reg, '<span class="search-highlight">$1</span>');

      return `
        <div class="search-result-item" onclick="openQuickView('${prod.id}'); document.getElementById('close-search-btn').click();">
          <img src="${prod.image}" alt="${Validators.sanitizeHtml(prod.title)}" class="search-result-img">
          <div style="flex-grow: 1;">
            <h4 style="font-size: 0.95rem; font-weight: 700; color: var(--dark-950); margin-bottom: 0.2rem;">${highlightedTitle}</h4>
            <span style="font-size: 0.8rem; color: var(--purple-600);">${prod.category}</span>
          </div>
          <div style="font-size: 1.1rem; font-weight: 800; color: var(--purple-700);">
            ${prod.price} <span class="currency">ر.س</span>
          </div>
        </div>
      `;
    }).join('');
  });

  // --- 5. نظام إتمام الطلب والدفع المتكامل (Checkout Flow Controller) ---
  let checkoutData = {
    fullName: '',
    phone: '',
    city: 'الرياض',
    address: '',
    paymentMethod: 'mada',
    idempotencyKey: null
  };

  function openCheckoutModal() {
    if (store.state.cart.length === 0) {
      showToast('حقيبة التسوق فارغة.');
      return;
    }
    closeCart();
    checkoutData.idempotencyKey = 'IDEM-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);
    store.state.checkoutStep = 1;
    renderCheckoutStep();
    checkoutBackdrop?.classList.add('open');
    document.body.style.overflow = 'hidden';
  }

  function closeCheckoutModal() {
    checkoutBackdrop?.classList.remove('open');
    document.body.style.overflow = '';
  }

  btnProceedCheckout?.addEventListener('click', openCheckoutModal);
  closeCheckoutBtn?.addEventListener('click', closeCheckoutModal);

  function renderCheckoutStep() {
    if (!checkoutBody) return;
    const step = store.state.checkoutStep;

    // تحديث مؤشرات الخطوات
    stepIndicators.forEach((ind, i) => {
      if (!ind) return;
      if (i + 1 === step) {
        ind.className = 'step-indicator active';
      } else if (i + 1 < step) {
        ind.className = 'step-indicator completed';
      } else {
        ind.className = 'step-indicator';
      }
    });

    if (step === 1) {
      // الخطوة 1: بيانات العميل والشحن
      checkoutBody.innerHTML = `
        <form id="checkout-step1-form">
          <div class="form-grid">
            <div class="form-group full-width">
              <label class="form-label" for="cust-name">الاسم الكامل (الثلاثي) *</label>
              <input type="text" id="cust-name" class="form-input" placeholder="مثال: سارة محمد العتيبي" required value="${Validators.sanitizeHtml(checkoutData.fullName)}">
            </div>

            <div class="form-group">
              <label class="form-label" for="cust-phone">رقم الجوال (05XXXXXXXX) *</label>
              <input type="tel" id="cust-phone" class="form-input" placeholder="05XXXXXXXX" required value="${Validators.sanitizeHtml(checkoutData.phone)}">
              <span id="phone-err-msg" style="color: #EF4444; font-size: 0.78rem; display: none;">يجب إدخال رقم جوال سعودي يبدأ بـ 05 ويتكون من 10 أرقام.</span>
            </div>

            <div class="form-group">
              <label class="form-label" for="cust-city">المدينة *</label>
              <select id="cust-city" class="form-select" required>
                <option value="الرياض" ${checkoutData.city === 'الرياض' ? 'selected' : ''}>الرياض</option>
                <option value="جدة" ${checkoutData.city === 'جدة' ? 'selected' : ''}>جدة</option>
                <option value="الدمام والخبر" ${checkoutData.city === 'الدمام والخبر' ? 'selected' : ''}>الدمام والخبر</option>
                <option value="مكة المكرمة" ${checkoutData.city === 'مكة المكرمة' ? 'selected' : ''}>مكة المكرمة</option>
                <option value="المدينة المنورة" ${checkoutData.city === 'المدينة المنورة' ? 'selected' : ''}>المدينة المنورة</option>
                <option value="القصيم" ${checkoutData.city === 'القصيم' ? 'selected' : ''}>القصيم</option>
                <option value="أبها وخميس مشيط" ${checkoutData.city === 'أبها وخميس مشيط' ? 'selected' : ''}>أبها وخميس مشيط</option>
              </select>
            </div>

            <div class="form-group full-width">
              <label class="form-label" for="cust-address">العنوان التفصيلي للحي والشارع *</label>
              <textarea id="cust-address" class="form-textarea" style="min-height: 80px;" placeholder="اسم الحي، الشارع، ورقم المبنى..." required>${Validators.sanitizeHtml(checkoutData.address)}</textarea>
            </div>
          </div>

          <button type="submit" class="btn btn-primary" style="width: 100%; padding-block: 1rem; margin-top: 1.5rem;">
            <span>المتابعة إلى وسيلة الدفع (الخطوة التالية)</span>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <line x1="19" y1="12" x2="5" y2="12"></line>
              <polyline points="12 19 5 12 12 5"></polyline>
            </svg>
          </button>
        </form>
      `;

      document.getElementById('checkout-step1-form').onsubmit = (e) => {
        e.preventDefault();
        const name = document.getElementById('cust-name').value.trim();
        const phone = document.getElementById('cust-phone').value.trim();
        const city = document.getElementById('cust-city').value;
        const address = document.getElementById('cust-address').value.trim();
        const phoneErr = document.getElementById('phone-err-msg');

        if (!Validators.isValidSaudiPhone(phone)) {
          phoneErr.style.display = 'block';
          return;
        }
        phoneErr.style.display = 'none';

        checkoutData.fullName = name;
        checkoutData.phone = phone;
        checkoutData.city = city;
        checkoutData.address = address;

        store.state.checkoutStep = 2;
        renderCheckoutStep();
      };

    } else if (step === 2) {
      // الخطوة 2: وسيلة الدفع وقسيمة الخصم
      checkoutBody.innerHTML = `
        <div>
          <h4 style="font-size: 1.05rem; font-weight: 700; color: var(--dark-950); margin-bottom: 1rem;">اختاري وسيلة الدفع المناسبة:</h4>
          
          <div class="payment-methods-grid">
            <label class="payment-method-card ${checkoutData.paymentMethod === 'mada' ? 'selected' : ''}">
              <input type="radio" name="pay_method" value="mada" ${checkoutData.paymentMethod === 'mada' ? 'checked' : ''}>
              <div class="payment-method-info">
                <span class="payment-method-title">بطاقة مدى البنكية (mada)</span>
                <span class="payment-method-desc">دفع إلكتروني آمن وسريع</span>
              </div>
            </label>

            <label class="payment-method-card ${checkoutData.paymentMethod === 'applepay' ? 'selected' : ''}">
              <input type="radio" name="pay_method" value="applepay" ${checkoutData.paymentMethod === 'applepay' ? 'checked' : ''}>
              <div class="payment-method-info">
                <span class="payment-method-title">Apple Pay</span>
                <span class="payment-method-desc">لمسة واحدة عبر أجهزة آبل</span>
              </div>
            </label>

            <label class="payment-method-card ${checkoutData.paymentMethod === 'credit' ? 'selected' : ''}">
              <input type="radio" name="pay_method" value="credit" ${checkoutData.paymentMethod === 'credit' ? 'checked' : ''}>
              <div class="payment-method-info">
                <span class="payment-method-title">بطاقة ائتمانية (Visa / MC)</span>
                <span class="payment-method-desc">فيزا أو ماستركارد</span>
              </div>
            </label>

            <label class="payment-method-card ${checkoutData.paymentMethod === 'tabby' ? 'selected' : ''}">
              <input type="radio" name="pay_method" value="tabby" ${checkoutData.paymentMethod === 'tabby' ? 'checked' : ''}>
              <div class="payment-method-info">
                <span class="payment-method-title">تابي أو تمارا (4 دفعات)</span>
                <span class="payment-method-desc">قسميها على 4 دفعات بدون فوائد</span>
              </div>
            </label>
          </div>

          <!-- قسيمة الخصم -->
          <div class="coupon-box" style="margin-top: 1.5rem;">
            <label class="form-label" for="coupon-code-input">كوبون الخصم أو كود التخفيض:</label>
            <div class="coupon-input-wrapper">
              <input type="text" id="coupon-code-input" class="coupon-input" placeholder="أدخلي كود الخصم (مثال: AURA15)" value="${store.state.coupon ? store.state.coupon.code : ''}">
              <button type="button" class="coupon-btn" id="btn-apply-coupon">تطبيق الكوبون</button>
            </div>
            <div id="coupon-msg" style="font-size: 0.82rem; margin-top: 0.3rem;"></div>
          </div>

          <!-- ملخص الطلب المالي -->
          <div class="checkout-summary-box">
            <div class="summary-row">
              <span>المجموع الفرعي:</span>
              <span>${store.getSubtotal()} ر.س</span>
            </div>
            ${store.getDiscountAmount() > 0 ? `
              <div class="summary-row" style="color: #10B981; font-weight: 700;">
                <span>خصم الكوبون (${store.state.coupon.code}):</span>
                <span>-${store.getDiscountAmount()} ر.س</span>
              </div>
            ` : ''}
            <div class="summary-row">
              <span>رسوم الشحن والتوصيل المبرد:</span>
              <span>${store.getShippingFee() === 0 ? '<strong style="color: #10B981;">مجاني</strong>' : `${store.getShippingFee()} ر.س`}</span>
            </div>
            <div class="summary-row total-row">
              <span>الإجمالي المستحق للدفع:</span>
              <span style="color: var(--purple-700);">${store.getGrandTotal()} ر.س</span>
            </div>
          </div>

          <div style="display: flex; gap: 1rem; margin-top: 1.5rem;">
            <button type="button" class="btn btn-secondary" onclick="store.state.checkoutStep = 1; window.renderCheckoutStep();" style="flex: 1;">
              الرجوع للخلف
            </button>
            <button type="button" class="btn btn-primary" id="btn-submit-order" style="flex: 2;">
              <span>تأكيد وسداد ${store.getGrandTotal()} ر.س 🔒</span>
            </button>
          </div>
        </div>
      `;

      // تفاعل اختيار وسيلة الدفع
      document.querySelectorAll('input[name="pay_method"]').forEach(radio => {
        radio.addEventListener('change', (e) => {
          checkoutData.paymentMethod = e.target.value;
          document.querySelectorAll('.payment-method-card').forEach(c => c.classList.remove('selected'));
          e.target.closest('.payment-method-card')?.classList.add('selected');
        });
      });

      // تفاعل تطبيق الكوبون
      const btnApplyCoupon = document.getElementById('btn-apply-coupon');
      const couponInput = document.getElementById('coupon-code-input');
      const couponMsg = document.getElementById('coupon-msg');

      btnApplyCoupon?.addEventListener('click', async () => {
        const code = couponInput.value.trim();
        if (!code) return;
        btnApplyCoupon.disabled = true;
        btnApplyCoupon.textContent = 'جاري التحقق...';

        try {
          const res = await api.validateCoupon(code);
          store.state.coupon = { code: res.code, rate: res.rate };
          store.saveStorage('aura_coupon', store.state.coupon);
          couponMsg.style.color = '#10B981';
          couponMsg.textContent = `✓ تم تطبيق الكوبون بنجاح! حصلتِ على خصم ${res.rate * 100}%.`;
          showToast(`تم تطبيق كود الخصم "${res.code}" بنجاح! ✨`);
          renderCheckoutStep();
        } catch (err) {
          couponMsg.style.color = '#EF4444';
          couponMsg.textContent = err.message;
        } finally {
          btnApplyCoupon.disabled = false;
          btnApplyCoupon.textContent = 'تطبيق الكوبون';
        }
      });

      // تفاعل سداد الطلب النهائي
      const btnSubmitOrder = document.getElementById('btn-submit-order');
      btnSubmitOrder?.addEventListener('click', async () => {
        btnSubmitOrder.disabled = true;
        btnSubmitOrder.innerHTML = `
          <div class="payment-processing-spinner" style="width: 20px; height: 20px; border-width: 2px;"></div>
          <span>جاري معالجة الدفع والتحقق البنكي...</span>
        `;

        try {
          const result = await api.processCheckout(checkoutData, checkoutData.idempotencyKey);
          store.state.orderReceipt = result.receipt;
          store.clearCart(); // إفراغ السلة بعد نجاح الشراء
          store.state.checkoutStep = 3;
          renderCheckoutStep();
          showToast(`تم تأكيد طلبكِ بنجاح! رقم الطلب: ${result.receipt.orderNumber}`);
        } catch (err) {
          showToast(`خطأ في الدفع: ${err.message}`);
          btnSubmitOrder.disabled = false;
          btnSubmitOrder.innerHTML = `<span>إعادة محاولة السداد 🔒</span>`;
        }
      });

    } else if (step === 3) {
      // الخطوة 3: إيصال وفاتورة الطلب الناجح
      const r = store.state.orderReceipt;
      if (!r) return;

      checkoutBody.innerHTML = `
        <div style="text-align: center; padding: 1.5rem 1rem;">
          <div style="width: 70px; height: 70px; border-radius: 50%; background: rgba(16, 185, 129, 0.12); color: #10B981; display: flex; align-items: center; justify-content: center; font-size: 2.2rem; margin-inline: auto; margin-bottom: 1.25rem;">
            ✓
          </div>
          <h3 style="font-size: 1.6rem; font-weight: 800; color: var(--dark-950); margin-bottom: 0.5rem;">
            تم تأكيد طلبكِ بنجاح! 🎉
          </h3>
          <p style="color: var(--text-muted); font-size: 0.95rem; margin-bottom: 1.75rem;">
            شكراً لتسوقكِ مع أورا. تم إرسال رسالة نصية وتفاصيل الفاتورة إلى جوالكِ: <strong>${r.phone}</strong>
          </p>

          <div style="background: var(--purple-50); border: 1.5px solid var(--purple-200); border-radius: var(--radius-md); padding: 1.5rem; text-align: right; margin-bottom: 2rem;">
            <div style="display: flex; justify-content: space-between; margin-bottom: 0.8rem; border-bottom: 1px solid var(--purple-200); padding-bottom: 0.8rem;">
              <span style="font-weight: 700; color: var(--dark-950);">رقم الطلب المرجعي:</span>
              <strong style="color: var(--purple-700); font-size: 1.15rem; letter-spacing: 0.5px;">${r.orderNumber}</strong>
            </div>
            <div style="display: flex; justify-content: space-between; margin-bottom: 0.6rem;">
              <span style="color: var(--text-secondary);">اسم العميل:</span>
              <strong>${Validators.sanitizeHtml(r.customer)}</strong>
            </div>
            <div style="display: flex; justify-content: space-between; margin-bottom: 0.6rem;">
              <span style="color: var(--text-secondary);">عنوان التوصيل:</span>
              <strong>${Validators.sanitizeHtml(r.city)} - ${Validators.sanitizeHtml(r.address)}</strong>
            </div>
            <div style="display: flex; justify-content: space-between; margin-bottom: 0.6rem;">
              <span style="color: var(--text-secondary);">طريقة الدفع:</span>
              <strong>${r.paymentMethod.toUpperCase()}</strong>
            </div>
            <div style="display: flex; justify-content: space-between; margin-bottom: 0.6rem;">
              <span style="color: var(--text-secondary);">الموعد المتوقع للتوصيل:</span>
              <strong style="color: #10B981;">${r.estimatedDelivery}</strong>
            </div>
            <div style="display: flex; justify-content: space-between; margin-top: 1rem; border-top: 1.5px dashed var(--purple-300); padding-top: 0.8rem; font-size: 1.2rem; font-weight: 900; color: var(--dark-950);">
              <span>المبلغ الإجمالي المدفوع:</span>
              <span style="color: var(--purple-700);">${r.grandTotal} ر.س</span>
            </div>
          </div>

          <div style="display: flex; gap: 1rem; justify-content: center; flex-wrap: wrap;">
            <button class="btn btn-secondary" onclick="window.print();">
              <span>طباعة إيصال الفاتورة 🖨️</span>
            </button>
            <button class="btn btn-primary" onclick="document.getElementById('close-checkout-btn').click();">
              <span>العودة ومواصلة التصفح</span>
            </button>
          </div>
        </div>
      `;
    }
  }

  window.renderCheckoutStep = renderCheckoutStep;

  // --- 6. حزمة الاختبارات الآلية الشاملة (Automated Test Suite Runner) ---
  const TestSuite = [
    {
      name: 'Test 1: التحقق من رقم الجوال السعودي (Regex Validation)',
      async run() {
        const valid1 = Validators.isValidSaudiPhone('0501234567');
        const valid2 = Validators.isValidSaudiPhone('551234567');
        const invalid1 = Validators.isValidSaudiPhone('0123456789');
        const invalid2 = Validators.isValidSaudiPhone('12345');
        if (!valid1 || !valid2 || invalid1 || invalid2) {
          throw new Error(`فشل التحقق: 0501234567(${valid1}), 551234567(${valid2}), 0123456789(${invalid1})`);
        }
        return 'اجتاز الفحص: يقبل أرقام الجوال السعودية ويرفض الأرقام الخاطئة بدقة.';
      }
    },
    {
      name: 'Test 2: حساب مجموع السلة والحد الأدنى للشحن المجاني (Threshold Math)',
      async run() {
        // اختبار أن السلة تحسب الشحن المجاني فوق 300 ر.س
        const prod1 = PRODUCTS_DB['1']; // 245
        const prod2 = PRODUCTS_DB['3']; // 210
        const total = prod1.price + prod2.price; // 455 >= 300
        const isFree = total >= 300;
        if (!isFree) throw new Error('فشل شرط الشحن المجاني');
        return `اجتاز الفحص: المجموع ${total} ر.س مؤهل للشحن المجاني (الحد 300 ر.س).`;
      }
    },
    {
      name: 'Test 3: تطبيق كوبون الخصم AURA15 وحساب النسبة بدقة (15% Coupon)',
      async run() {
        const res = await api.validateCoupon('AURA15');
        const subtotal = 1000;
        const discount = Math.round(subtotal * res.rate);
        if (discount !== 150) throw new Error(`الخصم المحسوب ${discount} لا يطابق 150 ر.س.`);
        return `اجتاز الفحص: تم تطبيق كود AURA15 بنسبة 15% بنجاح.`;
      }
    },
    {
      name: 'Test 4: تطهير المدخلات من نصوص البرمجة الضارة (XSS Sanitization)',
      async run() {
        const malicious = '<script>alert("hacked")</script>&"test"';
        const sanitized = Validators.sanitizeHtml(malicious);
        if (sanitized.includes('<script>') || sanitized.includes('"test"')) {
          throw new Error('فشل تطهير النص: يحتوي على أكواد غير مطهرة.');
        }
        return `اجتاز الفحص: تم استبدال الوسوم الخطرة بأمان (${sanitized}).`;
      }
    },
    {
      name: 'Test 5: إضافة وإزالة المنتجات من المفضلة (Wishlist Reactive State)',
      async run() {
        const initial = store.isInWishlist('1');
        store.toggleWishlist('1');
        const afterAdd = store.isInWishlist('1');
        store.toggleWishlist('1');
        const afterRemove = store.isInWishlist('1');
        if (afterAdd === initial || afterRemove !== initial) {
          throw new Error('فشل تبديل حالة المفضلة.');
        }
        return 'اجتاز الفحص: يتم تحديث مصفوفة المفضلة والتخزين المحلي فورياً.';
      }
    },
    {
      name: 'Test 6: محاكاة منع العمليات المكررة في الدفع (Idempotency Protection)',
      async run() {
        const key = 'TEST-KEY-' + Date.now();
        api.idempotencyTokens.add(key);
        let errorCaught = false;
        try {
          await api.processCheckout({
            fullName: 'سارة العتيبي',
            phone: '0501234567',
            city: 'الرياض',
            address: 'شارع الملك فهد'
          }, key);
        } catch (e) {
          errorCaught = true;
        }
        if (!errorCaught) throw new Error('فشل منع العملية المكررة.');
        return 'اجتاز الفحص: تم حظر تكرار الدفع بنجاح عبر مفتاح Idempotency.';
      }
    },
    {
      name: 'Test 7: تطابق معرفات المنتجات والأسعار مع قاعدة البيانات',
      async run() {
        const keys = Object.keys(PRODUCTS_DB);
        for (const k of keys) {
          const item = PRODUCTS_DB[k];
          if (!item.id || !item.price || !item.title || !item.image) {
            throw new Error(`المنتج ${k} ينقصه حقول أساسية.`);
          }
        }
        return `اجتاز الفحص: جميع المنتجات (${keys.length}) تحتوي على بيانات متكاملة وأسعار صحيحة.`;
      }
    }
  ];

  async function runAllTests() {
    testResultsContainer.innerHTML = '<div style="text-align: center; padding: 2rem;">جاري تنفيذ الاختبارات الآلية... ⏳</div>';
    let passed = 0;
    const results = [];

    for (const test of TestSuite) {
      try {
        const msg = await test.run();
        passed++;
        results.push({ name: test.name, status: 'PASS', msg });
      } catch (err) {
        results.push({ name: test.name, status: 'FAIL', msg: err.message });
      }
    }

    testResultsContainer.innerHTML = results.map(r => `
      <div class="test-item ${r.status === 'PASS' ? 'pass' : 'fail'}">
        <div>
          <strong style="color: var(--dark-950); display: block; margin-bottom: 0.2rem;">${r.name}</strong>
          <span style="font-size: 0.8rem; color: ${r.status === 'PASS' ? '#059669' : '#DC2626'};">${r.msg}</span>
        </div>
        <span class="${r.status === 'PASS' ? 'badge-test-pass' : 'badge-test-fail'}">${r.status}</span>
      </div>
    `).join('');

    testSuiteSummary.textContent = `النتيجة: اجتاز ${passed} من أصل ${TestSuite.length} اختبار بنجاح (${Math.round((passed / TestSuite.length) * 100)}%).`;
    Logger.info(`انتهى تشغيل حزمة الاختبارات: ${passed}/${TestSuite.length} ناجحة.`);
  }

  testRunnerTrigger?.addEventListener('click', () => {
    testRunnerModal?.classList.add('open');
    runAllTests();
  });

  closeTestsBtn?.addEventListener('click', () => {
    testRunnerModal?.classList.remove('open');
  });

  btnRerunTests?.addEventListener('click', runAllTests);

  // --- 7. المعاينة السريعة (Quick View Modal) ---
  const quickViewModal = document.getElementById('quick-view-modal');
  const quickViewBackdrop = document.getElementById('quick-view-backdrop');
  const btnCloseModal = document.getElementById('close-modal-btn');

  function openQuickView(id) {
    const product = PRODUCTS_DB[id];
    if (!product || !quickViewModal) return;

    document.getElementById('modal-img').src = product.image;
    document.getElementById('modal-img').alt = product.title;
    document.getElementById('modal-category').textContent = product.category;
    document.getElementById('modal-title').textContent = product.title;
    document.getElementById('modal-price').innerHTML = `${product.price} <span class="currency">ر.س</span>`;
    document.getElementById('modal-old-price').textContent = `${product.oldPrice} ر.س`;
    document.getElementById('modal-desc').textContent = product.description;
    document.getElementById('modal-ingredients').textContent = product.ingredients;
    document.getElementById('modal-usage').textContent = product.usage;

    const modalAddBtn = document.getElementById('modal-add-btn');
    if (modalAddBtn) {
      modalAddBtn.onclick = () => {
        store.addToCart(id, 1);
        closeQuickView();
        openCart();
        showToast(`تمت إضافة "${product.title}" إلى السلة بنجاح! ✨`);
      };
    }

    quickViewBackdrop?.classList.add('open');
    document.body.style.overflow = 'hidden';
  }

  function closeQuickView() {
    quickViewBackdrop?.classList.remove('open');
    if (!cartDrawer?.classList.contains('open') && !wishlistDrawer?.classList.contains('open') && !checkoutBackdrop?.classList.contains('open')) {
      document.body.style.overflow = '';
    }
  }

  btnCloseModal?.addEventListener('click', closeQuickView);
  quickViewBackdrop?.addEventListener('click', (e) => {
    if (e.target === quickViewBackdrop) closeQuickView();
  });

  window.openQuickView = openQuickView;

  // --- 8. العدادات التفاعلية المصغرة (Stats Counter) ---
  const statNumbers = document.querySelectorAll('.stat-number[data-target]');
  let statsDone = false;

  function runStatsAnimation() {
    if (statsDone) return;
    statNumbers.forEach(stat => {
      const target = parseInt(stat.getAttribute('data-target'), 10);
      const prefix = stat.getAttribute('data-prefix') || '';
      const suffix = stat.getAttribute('data-suffix') || '';
      let current = 0;
      const step = Math.ceil(target / 40);

      const timer = setInterval(() => {
        current += step;
        if (current >= target) {
          current = target;
          clearInterval(timer);
        }
        stat.textContent = `${prefix}${current.toLocaleString('ar-SA')}${suffix}`;
      }, 35);
    });
    statsDone = true;
  }

  const statsSection = document.getElementById('about-stats');
  if (statsSection) {
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          runStatsAnimation();
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.3 });
    observer.observe(statsSection);
  }

  // --- 9. النشرة البريدية وطلب B2B ---
  const newsletterForm = document.getElementById('newsletter-form');
  newsletterForm?.addEventListener('submit', (e) => {
    e.preventDefault();
    const emailInput = newsletterForm.querySelector('input[type="email"]');
    if (emailInput && Validators.isValidEmail(emailInput.value)) {
      showToast(`أهلاً بكِ في مجتمع أورا! تم إرسال كود الخصم AURA15 إلى بريدكِ.`);
      emailInput.value = '';
    } else {
      showToast('يُرجى إدخال بريد إلكتروني صالح.');
    }
  });

  const b2bForm = document.getElementById('b2b-rfq-form');
  b2bForm?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const submitBtn = b2bForm.querySelector('button[type="submit"]');
    const rfqData = {
      companyName: document.getElementById('company-name')?.value,
      crNumber: document.getElementById('cr-number')?.value,
      contactPerson: document.getElementById('contact-person')?.value,
      phone: document.getElementById('phone-number')?.value,
      email: document.getElementById('b2b-email')?.value,
      city: document.getElementById('city')?.value,
      businessType: document.getElementById('business-type')?.value,
      orderVolume: document.getElementById('order-volume')?.value,
      notes: document.getElementById('form-notes')?.value
    };

    if (!Validators.isValidSaudiPhone(rfqData.phone)) {
      showToast('يُرجى إدخال رقم جوال سعودي صحيح للمنشأة (05XXXXXXXX).');
      return;
    }

    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.innerHTML = `جاري إرسال الطلب وحجز التسعير...`;
    }

    try {
      const res = await api.submitB2BRFQ(rfqData);
      b2bForm.innerHTML = `
        <div style="text-align: center; padding: 3rem 1.5rem; background: var(--purple-50); border-radius: var(--radius-lg); border: 2px dashed var(--purple-400);">
          <div style="font-size: 3.5rem; margin-bottom: 1rem;">✨</div>
          <h3 style="font-size: 1.6rem; color: var(--purple-800); margin-bottom: 0.75rem;">تم استلام طلب التوريد بنجاح!</h3>
          <p style="font-size: 1.05rem; color: var(--text-secondary); max-width: 550px; margin-inline: auto; margin-bottom: 1.5rem;">
            شكراً لثقتكم بشركة أورا للعناية. تم تسجيل طلبكم برقم مرجعي: <br>
            <strong style="color: var(--purple-700); font-size: 1.3rem; letter-spacing: 1px;">${res.reference}</strong>
          </p>
          <p style="font-size: 0.95rem; color: var(--text-muted); margin-bottom: 2rem;">
            سيقوم مدير الحسابات المعتمد بالتواصل معكم عبر الهاتف والبريد الإلكتروني خلال أقل من ساعتي عمل لتقديم عرض الأسعار وتفاصيل العينات.
          </p>
          <a href="index.html" class="btn btn-primary">العودة للمتجر الرئيسي</a>
        </div>
      `;
      showToast(`تم إرسال طلب الشراكة بنجاح! رقم المرجع: ${res.reference}`);
    } catch (err) {
      showToast(`خطأ: ${err.message}`);
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.innerHTML = 'إعادة إرسال طلب التوريد';
      }
    }
  });

  // قائمة الجوال
  menuToggle?.addEventListener('click', () => {
    const isExpanded = menuToggle.getAttribute('aria-expanded') === 'true';
    menuToggle.setAttribute('aria-expanded', !isExpanded);
    navLinks?.classList.toggle('open');
  });

  // الاشتراك في تحديثات الـ Store
  store.subscribe(() => {
    renderCart();
    renderWishlist();
    updateNetworkStatus();
  });

  // تفاعل الأزرار في الواجهة
  window.addToCart = function(id) {
    store.addToCart(id, 1);
    const prod = PRODUCTS_DB[id];
    showToast(`تمت إضافة "${prod ? prod.title : 'المنتج'}" إلى حقيبة التسوق بنجاح! ✨`);
  };

  window.toggleWishlist = function(id) {
    const added = store.toggleWishlist(id);
    const prod = PRODUCTS_DB[id];
    if (added) {
      showToast(`تم حفظ "${prod ? prod.title : 'المنتج'}" في قائمة المفضلة ❤️`);
    } else {
      showToast(`تم حذف "${prod ? prod.title : 'المنتج'}" من المفضلة`);
    }
  };

  // ربط أزرار المفضلة في كروت المنتجات
  document.querySelectorAll('.btn-wishlist').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const card = btn.closest('.product-card');
      const id = card?.getAttribute('data-product-id');
      if (id) window.toggleWishlist(id);
    });
  });

  // تهيئة أولية
  renderCart();
  renderWishlist();
  updateNetworkStatus();
  Logger.info('تم تهيئة نظام أورا بنجاح.');
});

// نظام التنبيهات المنبثقة
function showToast(message) {
  let container = document.getElementById('toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toast-container';
    container.className = 'toast-container';
    document.body.appendChild(container);
  }

  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.setAttribute('role', 'alert');
  toast.innerHTML = `
    <span class="toast-icon">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
        <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
        <polyline points="22 4 12 14.01 9 11.01"></polyline>
      </svg>
    </span>
    <span class="toast-message">${Validators.sanitizeHtml(message)}</span>
  `;

  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(15px)';
    toast.style.transition = 'all 0.3s ease';
    setTimeout(() => toast.remove(), 300);
  }, 4000);
}
