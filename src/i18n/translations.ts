import type { Language } from '../types';

export interface Translations {
  brandName: string;
  nav: {
    collection: string;
    craftsmanship: string;
    bag: string;
  };
  hero: {
    kicker: string;
    title: string;
    subtitle: string;
    primaryCta: string;
    secondaryCta: string;
  };
  catalog: {
    heading: string;
    subheading: string;
    searchPlaceholder: string;
    categories: {
      all: string;
      outerwear: string;
      tailoring: string;
      knitwear: string;
      shirts: string;
    };
    quickViewBtn: string;
    selectSizeBtn: string;
    pickSizePrompt: string;
    addToBagBtn: string;
    currency: string;
    emptyState: string;
  };
  craft: {
    heading: string;
    subheading: string;
    pillars: Array<{
      index: string;
      title: string;
      body: string;
    }>;
  };
  productModal: {
    selectSize: string;
    fabricLabel: string;
    colorLabel: string;
    addToBag: string;
    close: string;
  };
  cart: {
    title: string;
    emptyTitle: string;
    emptyDesc: string;
    browseBtn: string;
    size: string;
    subtotal: string;
    shipping: string;
    freeShipping: string;
    freeShippingProgress: string;
    checkoutBtn: string;
    checkoutTitle: string;
    fullName: string;
    fullNamePlaceholder: string;
    phone: string;
    phonePlaceholder: string;
    cityAddress: string;
    cityAddressPlaceholder: string;
    detectingLocation: string;
    currentLocationActive: string;
    chosenLocationActive: string;
    useCurrentLocationBtn: string;
    chooseLocationOnMapBtn: string;
    locationDeniedHint: string;
    notes: string;
    notesPlaceholder: string;
    paymentMethod: string;
    codLabel: string;
    cardLabel: string;
    placeOrder: string;
    backToBag: string;
    confirmedTitle: string;
    confirmedDesc: string;
    orderNumber: string;
    customerSummaryTitle: string;
    continueShopping: string;
  };
  footer: {
    tagline: string;
    rights: string;
    themeLabel: string;
    langLabel: string;
  };
}

export const TRANSLATIONS: Record<Language, Translations> = {
  ar: {
    brandName: 'مَرايا',
    nav: {
      collection: 'الكوليكشن',
      craftsmanship: 'الخامات والتفصيل',
      bag: 'الشنطة',
    },
    hero: {
      kicker: 'كوليكشن الخريف والشتاء · دار مَرايا للأزياء المعاصرة',
      title: 'تفصيل معماري وخامات فاخرة بلمسة عصرية',
      subtitle:
        'اتفرج على قطع دار مَرايا بتصوير واضح يبين جودة القَصّة والخامات الطبيعية من الصوف البكر والحرير والكتان البلجيكي.',
      primaryCta: 'شوف الكوليكشن',
      secondaryCta: 'اعرف أكتر عن خاماتنا',
    },
    catalog: {
      heading: 'الكوليكشن المختار',
      subheading: 'عرض واضح لكل قطعة عشان تشوف القَصّة وتفاصيل القماش قبل ما تضيفها للشنطة.',
      searchPlaceholder: 'دور على بالطو، بليزر، حرير...',
      categories: {
        all: 'الكل',
        outerwear: 'بالطوهات وجواكت',
        tailoring: 'بليزرات وتفصيل',
        knitwear: 'تريكو وبلوفرات',
        shirts: 'قمصان',
      },
      quickViewBtn: 'تفاصيل القطعة',
      selectSizeBtn: 'اختار المقاس',
      pickSizePrompt: 'اختار المقاس عشان تضيف للشنطة',
      addToBagBtn: 'أضف للشنطة',
      currency: 'ج.م',
      emptyState: 'مفيش قطع مطابقة لبحثك دلوقتي.',
    },
    craft: {
      heading: 'جودة الدار والتفصيل',
      subheading: 'بنجمع بين دقة التفصيل وأفخم الأقمشة الإيطالية والبلجيكية عشان نقدم لك قطع تعيش معاك مواسم كتير.',
      pillars: [
        {
          index: '01.',
          title: 'خامات طبيعية مختارة',
          body: 'بنشتغل بصوف الميرينو البكر، الكشمير، حرير التوت المغسول، والكتان البلجيكي الفاخر لراحة وشكل يدوم.',
        },
        {
          index: '02.',
          title: 'قصّات مظبوطة ومتقنة',
          body: 'كل قطعة متفصلة بتوازن دقيق لخط الأكتاف والياقة عشان تديك إطلالة أنيقة في الشغل أو الخروجات.',
        },
        {
          index: '03.',
          title: 'تغليف شيك وشحن سريع في مصر',
          body: 'بنجهز طلبك بعناية داخل الدار مع إمكانية الدفع عند الاستلام أو بالكارت، وشحن مجاني للأوردرات فوق 15,000 ج.م.',
        },
      ],
    },
    productModal: {
      selectSize: 'اختار المقاس',
      fabricLabel: 'الخامة والعناية',
      colorLabel: 'اللون',
      addToBag: 'أضف للشنطة',
      close: 'اقفل',
    },
    cart: {
      title: 'شنطة التسوق',
      emptyTitle: 'شنطتك فاضية دلوقتي',
      emptyDesc: 'اتفرج على الكوليكشن المختار وضيف القطع اللي تعجبك لشنطتك.',
      browseBtn: 'شوف الكوليكشن',
      size: 'المقاس',
      subtotal: 'المجموع',
      shipping: 'الشحن',
      freeShipping: 'مجاني',
      freeShippingProgress: 'شحن مجاني جوه مصر للأوردرات فوق 15,000 ج.م',
      checkoutBtn: 'كمل الأوردر',
      checkoutTitle: 'بيانات التوصيل',
      fullName: 'اسم العميل',
      fullNamePlaceholder: 'اكتب اسمك بالكامل',
      phone: 'رقم الموبايل',
      phonePlaceholder: '01xxxxxxxxx',
      cityAddress: 'العنوان بالتفصيل',
      cityAddressPlaceholder: 'المحافظة، المنطقة، اسم الشارع، رقم العمارة والشقة',
      detectingLocation: 'جاري تحديد موقعك الحالي تلقائياً...',
      currentLocationActive: 'تم تحديد موقعك الحالي تلقائياً',
      chosenLocationActive: 'تم استخدام اللوكيشن اللي اخترته',
      useCurrentLocationBtn: 'موقعي الحالي',
      chooseLocationOnMapBtn: 'اختار لوكيشن تاني من الخريطة',
      locationDeniedHint: 'مش قادرين نوصل لموقعك الحالي تلقائياً — اكتب عنوانك أو اختاره من الخريطة.',
      notes: 'ملاحظات',
      notesPlaceholder: 'اكتب أي ملاحظات للمندوب أو ميعاد الاستلام المناسب (اختياري)',
      paymentMethod: 'طريقة الدفع',
      codLabel: 'الدفع عند الاستلام',
      cardLabel: 'فيزا / ماستركارد / ميزة',
      placeOrder: 'تأكيد الأوردر',
      backToBag: 'رجوع للشنطة',
      confirmedTitle: 'تم تأكيد أوردرك بنجاح',
      confirmedDesc: 'شكراً لتسوقك من دار مَرايا. أوردرك بيتجهز وهيتبعت لك تأكيد على موبايلك.',
      orderNumber: 'رقم الأوردر',
      customerSummaryTitle: 'بيانات الأوردر المسجلة',
      continueShopping: 'كمل تسوق',
    },
    footer: {
      tagline: 'دار أزياء معاصرة بتصميم دقيق وخامات مختارة في مصر.',
      rights: '© 2026 دار مَرايا للأزياء. جميع الحقوق محفوظة.',
      themeLabel: 'المظهر',
      langLabel: 'اللغة',
    },
  },
  en: {
    brandName: 'MARAYA',
    nav: {
      collection: 'Collection',
      craftsmanship: 'Atelier',
      bag: 'Bag',
    },
    hero: {
      kicker: 'Autumn / Winter · MARAYA Contemporary Atelier',
      title: 'Architectural tailoring crafted in noble fibers',
      subtitle:
        'Explore MARAYA ready-to-wear pieces in clean garment-first views highlighting virgin merino wool, washed mulberry silk, and Belgian linen.',
      primaryCta: 'Explore Collection',
      secondaryCta: 'Our Craftsmanship',
    },
    catalog: {
      heading: 'Featured Collection',
      subheading: 'Pure garment-only product views so you can inspect every cut, stitch, and fabric texture.',
      searchPlaceholder: 'Search trench, blazer, silk...',
      categories: {
        all: 'All',
        outerwear: 'Outerwear',
        tailoring: 'Tailoring',
        knitwear: 'Knitwear',
        shirts: 'Shirts',
      },
      quickViewBtn: 'Inspect Piece',
      selectSizeBtn: 'Select Size',
      pickSizePrompt: 'Choose a size to add to bag',
      addToBagBtn: 'Add to Bag',
      currency: 'EGP',
      emptyState: 'No garments match your current filter.',
    },
    craft: {
      heading: 'House Craft & Material Standards',
      subheading: 'Blending Belgian linen, washed mulberry silk, and Italian virgin wool with architectural cuts built to endure across seasons.',
      pillars: [
        {
          index: '01.',
          title: 'Curated Natural Fibers',
          body: 'Extra-fine merino wool, cashmere blends, 22-momme mulberry silk, and breathable Belgian linen chosen for lasting drape.',
        },
        {
          index: '02.',
          title: 'Architectural Tailoring',
          body: 'Balanced shoulder lines, sculpted collars, and clean concealed plackets engineered for effortless everyday and evening wear.',
        },
        {
          index: '03.',
          title: 'Atelier Packaging & Egypt Delivery',
          body: 'Every order ships carefully pressed across Egypt with complimentary express delivery over 15,000 EGP.',
        },
      ],
    },
    productModal: {
      selectSize: 'Select Size',
      fabricLabel: 'Fabric & Composition',
      colorLabel: 'Colorway',
      addToBag: 'Add to Bag',
      close: 'Close',
    },
    cart: {
      title: 'Shopping Bag',
      emptyTitle: 'Your bag is currently empty',
      emptyDesc: 'Explore the curated collection and add your favorite silhouettes to your bag.',
      browseBtn: 'Browse Collection',
      size: 'Size',
      subtotal: 'Subtotal',
      shipping: 'Shipping',
      freeShipping: 'Complimentary',
      freeShippingProgress: 'Complimentary express shipping across Egypt on orders over 15,000 EGP',
      checkoutBtn: 'Proceed to Checkout',
      checkoutTitle: 'Delivery Details',
      fullName: 'Customer Name',
      fullNamePlaceholder: 'Enter full name',
      phone: 'Mobile Number',
      phonePlaceholder: '+20 1x xxxx xxxx',
      cityAddress: 'Delivery Address',
      cityAddressPlaceholder: 'Governorate, district, street name, building & apt.',
      detectingLocation: 'Detecting your current location automatically...',
      currentLocationActive: 'Using your current GPS location',
      chosenLocationActive: 'Using your selected location',
      useCurrentLocationBtn: 'Use Current GPS',
      chooseLocationOnMapBtn: 'Choose Location on Map',
      locationDeniedHint: 'Could not detect GPS location automatically — enter your address or pick on the map.',
      notes: 'Order Notes',
      notesPlaceholder: 'Add delivery instructions or preferred timing (optional)',
      paymentMethod: 'Payment Method',
      codLabel: 'Cash on Delivery',
      cardLabel: 'Visa / Mastercard / Meeza',
      placeOrder: 'Confirm Order',
      backToBag: 'Back to Bag',
      confirmedTitle: 'Order Confirmed',
      confirmedDesc: 'Thank you for shopping with MARAYA. Your parcel is being prepared at our atelier.',
      orderNumber: 'Order Reference',
      customerSummaryTitle: 'Submitted Order Details',
      continueShopping: 'Continue Shopping',
    },
    footer: {
      tagline: 'Contemporary bilingual fashion atelier in Egypt crafted with precision.',
      rights: '© 2026 MARAYA Atelier. All rights reserved.',
      themeLabel: 'Appearance',
      langLabel: 'Language',
    },
  },
};
