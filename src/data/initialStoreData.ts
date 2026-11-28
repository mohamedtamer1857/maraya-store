import type { Product, StoreCategory } from '../types';

export interface StoredStaffMember {
  id: number;
  username: string;
  displayName: string | null;
  passwordHash: string | null;
  role: 'admin' | 'manager' | 'operations' | 'viewer';
  canViewOrders: boolean;
  canUpdateOrderStatus: boolean;
  canViewSales: boolean;
  canManageStaff: boolean;
  canManageProducts: boolean;
  isActive: boolean;
  isPrimaryAdmin: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface StoredOrderItem {
  id: number;
  orderId: number;
  sku: string;
  title: string;
  size: string;
  quantity: number;
}

export interface StoredOrderStaffNote {
  id: number;
  orderId: number;
  staffUsername: string;
  staffName: string | null;
  note: string;
  createdAt: string;
}

export interface StoredOrder {
  id: number;
  orderRef: string;
  fullName: string;
  phone: string;
  address: string;
  notes: string;
  paymentMethod: 'cod' | 'card';
  currency: 'EGP' | 'USD' | 'SAR';
  totalAmount: number;
  status: 'confirmed' | 'processing' | 'shipped' | 'delivered' | 'cancelled';
  createdAt: string;
  items: StoredOrderItem[];
  staffNotesList: StoredOrderStaffNote[];
}

export interface StoreDatabase {
  nextProductSeq: number;
  nextCategorySeq: number;
  nextOrderSeq: number;
  nextOrderItemSeq: number;
  nextNoteSeq: number;
  nextStaffSeq: number;
  categories: StoreCategory[];
  products: Product[];
  orders: StoredOrder[];
  staffMembers: StoredStaffMember[];
}

export const INITIAL_STORE_DATA: StoreDatabase = {
  nextProductSeq: 8,
  nextCategorySeq: 5,
  nextOrderSeq: 5,
  nextOrderItemSeq: 5,
  nextNoteSeq: 2,
  nextStaffSeq: 1,
  categories: [
    {
      id: 1,
      slug: 'outerwear',
      nameAr: 'بالطوهات وجواكت',
      nameEn: 'Outerwear',
      isActive: true,
      sortOrder: 0,
    },
    {
      id: 2,
      slug: 'tailoring',
      nameAr: 'بليزرات وتفصيل',
      nameEn: 'Tailoring',
      isActive: true,
      sortOrder: 1,
    },
    {
      id: 3,
      slug: 'knitwear',
      nameAr: 'تريكو وبلوفرات',
      nameEn: 'Knitwear',
      isActive: true,
      sortOrder: 2,
    },
    {
      id: 4,
      slug: 'shirts',
      nameAr: 'قمصان',
      nameEn: 'Shirts',
      isActive: true,
      sortOrder: 3,
    },
  ],
  products: [
    {
      id: 'obsidian-wool-trench',
      sku: 'MRY-014',
      category: 'outerwear',
      image: '/src/assets/images/prod_only_trench_1795658686842.jpg',
      priceEgp: 18500,
      stockQty: 15,
      sizeStock: { XS: 3, S: 3, M: 3, L: 3, XL: 3 },
      isActive: true,
      sizes: ['XS', 'S', 'M', 'L', 'XL'],
      tag: {
        ar: 'إصدار محدود',
        en: 'Limited Run',
      },
      title: {
        ar: 'بالطو ترينش صوف أوبسيديان',
        en: 'Obsidian Wool Trench Coat',
      },
      subtitle: {
        ar: 'صوف ميرينو مزدوج الوجه',
        en: 'Double-faced Merino Wool',
      },
      color: {
        ar: 'فحمي غامق',
        en: 'Charcoal Obsidian',
        hex: '#222429',
      },
      fabric: {
        ar: '90% صوف ميرينو بكر · 10% كشمير · بطانة حرير كوبرو',
        en: '90% Virgin Merino Wool · 10% Cashmere · Cupro Silk Lining',
      },
      description: {
        ar: 'بالطو طويل بقَصّة مستقيمة وحزام وسط متناسق، متصمم عشان يديك توازن مثالي بين الدفا والشكل الانسيابي كل يوم.',
        en: 'Architectural longline trench tailored with a clean shoulder line and matching waist belt for structured everyday drape.',
      },
    },
    {
      id: 'savile-cobalt-blazer',
      sku: 'MRY-022',
      category: 'tailoring',
      image: '/src/assets/images/prod_only_blazer_1795658687589.jpg',
      priceEgp: 16500,
      stockQty: 15,
      sizeStock: { XS: 3, S: 3, M: 3, L: 3, XL: 3 },
      isActive: true,
      sizes: ['XS', 'S', 'M', 'L', 'XL'],
      tag: {
        ar: 'الأكثر طلباً',
        en: 'Signature Piece',
      },
      title: {
        ar: 'بليزر كوبالت مزدوج الأزرار',
        en: 'Savile Cobalt Double-Breasted Blazer',
      },
      subtitle: {
        ar: 'تفصيل متماسك من الصوف البارد',
        en: 'Structured Cool-Wool Tailoring',
      },
      color: {
        ar: 'أزرق كوبالت',
        en: 'Savile Cobalt',
        hex: '#1E3A8A',
      },
      fabric: {
        ar: '100% صوف إيطالي منسوج · أزرار معدنية مطفية',
        en: '100% Italian Worsted Wool · Brushed Brass Hardware',
      },
      description: {
        ar: 'بليزر بدرجة الكوبالت العميقة مع أكتاف مظبوطة وزراير مزدوجة تدي حضور شيك في الخروجات المسائية أو الشغل.',
        en: 'Deep cobalt tailored blazer with sculpted lapels and matte brass double-breasted closure for sharp evening and studio styling.',
      },
    },
    {
      id: 'pearl-silk-poplin-shirt',
      sku: 'MRY-031',
      category: 'shirts',
      image: '/src/assets/images/prod_only_silk_shirt_1795658687955.jpg',
      priceEgp: 8900,
      stockQty: 15,
      sizeStock: { XS: 4, S: 4, M: 4, L: 3 },
      isActive: true,
      sizes: ['XS', 'S', 'M', 'L'],
      title: {
        ar: 'قميص حرير لؤلؤي منسدل',
        en: 'Pearl Ivory Silk Poplin Shirt',
      },
      subtitle: {
        ar: 'حرير التوت الطبيعي المغسول',
        en: 'Sandwashed Mulberry Silk',
      },
      color: {
        ar: 'عاجي لؤلؤي',
        en: 'Pearl Ivory',
        hex: '#EDEAE2',
      },
      fabric: {
        ar: '100% حرير توت طبيعي 22 موم · أزرار صدف',
        en: '100% 22-Momme Mulberry Silk · Mother-of-Pearl Buttons',
      },
      description: {
        ar: 'قميص بملمس حريري ناعم وياقة مظبوطة بتنسدل بشياكة، عملي ومناسب من الصبح لبليل.',
        en: 'Fluid sandwashed mulberry silk shirt with crisp collar architecture and hidden placket, effortless from morning to dusk.',
      },
    },
    {
      id: 'forest-suede-overshirt',
      sku: 'MRY-045',
      category: 'outerwear',
      image: '/src/assets/images/prod_only_overshirt_1795658687798.jpg',
      priceEgp: 19800,
      stockQty: 15,
      sizeStock: { S: 4, M: 4, L: 4, XL: 3 },
      isActive: true,
      sizes: ['S', 'M', 'L', 'XL'],
      tag: {
        ar: 'وصل حديثاً',
        en: 'New Arrival',
      },
      title: {
        ar: 'جاكيت شامواه زيتوني غامق',
        en: 'Forest Olive Suede Overshirt',
      },
      subtitle: {
        ar: 'جلد شامواه إيطالي ناعم',
        en: 'Supple Italian Calf Suede',
      },
      color: {
        ar: 'زيتوني غامق',
        en: 'Forest Olive',
        hex: '#364133',
      },
      fabric: {
        ar: '100% جلد شامواه طبيعي · أزرار قرنية مصقولة',
        en: '100% Full-Grain Calf Suede · Horn Buttons',
      },
      description: {
        ar: 'جاكيت عملي بقَصّة قميص عصرية وجيوب صدر متناظرة، مصنوع من الشامواه الفاخر بملمس ناعم ومرن.',
        en: 'Modern utility overshirt crafted from velvety Italian calf suede with dual chest flap pockets and tonal stitching.',
      },
    },
    {
      id: 'oxblood-merino-knit',
      sku: 'MRY-058',
      category: 'knitwear',
      image: '/src/assets/images/prod_only_burgundy_knit_1795658687857.jpg',
      priceEgp: 9500,
      stockQty: 15,
      sizeStock: { XS: 3, S: 3, M: 3, L: 3, XL: 3 },
      isActive: true,
      sizes: ['XS', 'S', 'M', 'L', 'XL'],
      title: {
        ar: 'بلوفر ميرينو عنابي مضلع',
        en: 'Oxblood Ribbed Merino Sweater',
      },
      subtitle: {
        ar: 'تريكو ثقيل بياقة عالية',
        en: 'Heavyweight Mock-Neck Knit',
      },
      color: {
        ar: 'عنابي غامق',
        en: 'Oxblood Burgundy',
        hex: '#4A1D24',
      },
      fabric: {
        ar: '100% صوف ميرينو ناعم جداً (7 غرز)',
        en: '100% Extra-Fine Merino Wool (7-Gauge)',
      },
      description: {
        ar: 'بلوفر دافي بحياكة مضلعة وأكتاف مريحة، بيجمع بين الراحة العالية والشكل المظبوط والأنيق.',
        en: 'Sculpted horizontal-rib knit sweater with drop shoulders and a clean mock-neck collar in rich oxblood.',
      },
    },
    {
      id: 'desert-taupe-kaftan-coat',
      sku: 'MRY-063',
      category: 'tailoring',
      image: '/src/assets/images/prod_only_taupe_coat_1795658688943.jpg',
      priceEgp: 21000,
      stockQty: 15,
      sizeStock: { XS: 4, S: 4, M: 4, L: 3 },
      isActive: true,
      sizes: ['XS', 'S', 'M', 'L'],
      tag: {
        ar: 'حصري للدار',
        en: 'Atelier Exclusive',
      },
      title: {
        ar: 'بالطو قفطان رملي بحزام معماري',
        en: 'Desert Taupe Belted Coat',
      },
      subtitle: {
        ar: 'مزيج الكتان والصوف الخفيف',
        en: 'Linen-Wool Architectural Coat',
      },
      color: {
        ar: 'رملي دافي',
        en: 'Desert Taupe',
        hex: '#A89683',
      },
      fabric: {
        ar: '55% كتان بلجيكي · 45% صوف بكر خفيف',
        en: '55% Belgian Linen · 45% Lightweight Virgin Wool',
      },
      description: {
        ar: 'تصميم طويل بيجمع بين الشياكة الكلاسيكية ودقة التفصيل العصري مع ياقة عالية وحزام متغطي بنفس القماش.',
        en: 'Architectural long coat blending timeless drape with sharp tailoring, stand collar, and self-covered belt.',
      },
    },
    {
      id: 'blezer-801',
      sku: 'MRY-078',
      category: 'outerwear',
      image: '/src/assets/images/prod_only_trench_1795658686842.jpg',
      priceEgp: 1000,
      stockQty: 9,
      sizeStock: { XS: 2, S: 2, M: 2, L: 2, XL: 1 },
      isActive: true,
      sizes: ['XS', 'S', 'M', 'L', 'XL'],
      title: {
        ar: 'بليزر',
        en: 'blezer',
      },
      subtitle: {
        ar: 'بليزر',
        en: 'blezer',
      },
      color: {
        ar: 'أسود كلاسيكي',
        en: 'Classic Obsidian',
        hex: '#181B20',
      },
      fabric: {
        ar: 'خامة طبيعية فاخرة من دار مَرايا',
        en: 'MARAYA Signature Natural Textile',
      },
      description: {
        ar: 'بليزر',
        en: 'blezer',
      },
    },
  ],
  orders: [
    {
      id: 1,
      orderRef: 'MRY-1572',
      fullName: 'Test Client',
      phone: '0500000000',
      address: 'Riyadh Olaya',
      notes: 'Smoke verification',
      paymentMethod: 'cod',
      currency: 'SAR',
      totalAmount: 1450,
      status: 'confirmed',
      createdAt: '2026-11-26T03:08:45.768Z',
      items: [
        {
          id: 1,
          orderId: 1,
          sku: 'MRY-001',
          title: 'Camel Coat',
          size: 'M',
          quantity: 1,
        },
      ],
      staffNotesList: [],
    },
    {
      id: 2,
      orderRef: 'MRY-2327',
      fullName: 'Ahmed Egypt',
      phone: '01000000000',
      address: 'Zamalek, Cairo, Egypt',
      notes: 'EGP verification',
      paymentMethod: 'cod',
      currency: 'EGP',
      totalAmount: 18500,
      status: 'confirmed',
      createdAt: '2026-11-26T03:17:20.714Z',
      items: [
        {
          id: 2,
          orderId: 2,
          sku: 'MRY-014',
          title: 'Obsidian Trench',
          size: 'M',
          quantity: 1,
        },
      ],
      staffNotesList: [],
    },
    {
      id: 3,
      orderRef: 'MRY-5893',
      fullName: 'Mohamed Tamer',
      phone: '01017071524',
      address: '3G55+6CW، ثانى القاهرة الجديدة، محافظة القاهرة‬ 4752060، مصر',
      notes: 'Test',
      paymentMethod: 'cod',
      currency: 'EGP',
      totalAmount: 16500,
      status: 'confirmed',
      createdAt: '2026-11-26T18:28:19.923Z',
      items: [
        {
          id: 3,
          orderId: 3,
          sku: 'MRY-022',
          title: 'بليزر كوبالت مزدوج الأزرار',
          size: 'L',
          quantity: 1,
        },
      ],
      staffNotesList: [],
    },
    {
      id: 4,
      orderRef: 'MRY-3728',
      fullName: 'Mohamed Tamer',
      phone: '01122087629',
      address: '3G55+6CW، ثانى القاهرة الجديدة، محافظة القاهرة‬ 4752060، مصر',
      notes: '',
      paymentMethod: 'cod',
      currency: 'EGP',
      totalAmount: 16500,
      status: 'shipped',
      createdAt: '2026-11-26T18:30:22.000Z',
      items: [
        {
          id: 4,
          orderId: 4,
          sku: 'MRY-022',
          title: 'بليزر كوبالت مزدوج الأزرار',
          size: 'L',
          quantity: 1,
        },
      ],
      staffNotesList: [
        {
          id: 1,
          orderId: 4,
          staffUsername: 'admin',
          staffName: 'Mohamed Tameer',
          note: 'العميل لم يرد — جاري إعادة المحاولة',
          createdAt: '2026-11-26T18:39:08.371Z',
        },
      ],
    },
  ],
  staffMembers: [],
};
