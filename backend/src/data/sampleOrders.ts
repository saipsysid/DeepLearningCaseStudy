/**
 * Sample order data for development/demo purposes.
 * These 20 records cover all possible order statuses and scenarios
 * that the support agent might need to handle.
 */

export interface OrderItem {
  name: string;
  qty: number;
  price: number; // price per unit in INR
}

export interface Order {
  id: string;
  customer_name: string;
  customer_email: string;
  items: OrderItem[];
  total_amount: number;
  status:
    | "pending"
    | "processing"
    | "shipped"
    | "delivered"
    | "cancelled"
    | "refund_requested"
    | "refunded";
  delivery_address: string;
  created_at: string;
  delivered_at: string | null;
  notes: string | null;
}

export const sampleOrders: Order[] = [
  {
    id: "ORD-001",
    customer_name: "Rahul Sharma",
    customer_email: "rahul.sharma@example.com",
    items: [
      { name: "Amul Full Cream Milk 1L", qty: 2, price: 68 },
      { name: "Britannia Bread", qty: 1, price: 45 },
    ],
    total_amount: 181,
    status: "delivered",
    delivery_address: "B-204, Sector 62, Noida, UP 201309",
    created_at: "2024-01-20T08:30:00Z",
    delivered_at: "2024-01-20T09:05:00Z",
    notes: null,
  },
  {
    id: "ORD-002",
    customer_name: "Priya Patel",
    customer_email: "priya.patel@example.com",
    items: [
      { name: "Haldiram's Aloo Bhujia 400g", qty: 1, price: 120 },
      { name: "Pepsi 2L", qty: 2, price: 95 },
      { name: "Lay's Classic Salted 98g", qty: 3, price: 30 },
    ],
    total_amount: 400,
    status: "pending",
    delivery_address: "12, Linking Road, Bandra West, Mumbai 400050",
    created_at: "2024-01-22T14:20:00Z",
    delivered_at: null,
    notes: "Leave at door if not home",
  },
  {
    id: "ORD-003",
    customer_name: "Amit Kumar",
    customer_email: "amit.kumar@example.com",
    items: [{ name: "Surf Excel Matic 2kg", qty: 1, price: 320 }],
    total_amount: 320,
    status: "refund_requested",
    delivery_address: "Flat 5A, Green Park, New Delhi 110016",
    created_at: "2024-01-18T10:00:00Z",
    delivered_at: "2024-01-18T10:40:00Z",
    notes: "Customer received damaged product",
  },
  {
    id: "ORD-004",
    customer_name: "Sneha Reddy",
    customer_email: "sneha.reddy@example.com",
    items: [
      { name: "Mother Dairy Paneer 200g", qty: 2, price: 90 },
      { name: "Aashirvaad Atta 10kg", qty: 1, price: 420 },
    ],
    total_amount: 600,
    status: "shipped",
    delivery_address: "Plot 88, Jubilee Hills, Hyderabad 500033",
    created_at: "2024-01-21T11:00:00Z",
    delivered_at: null,
    notes: null,
  },
  {
    id: "ORD-005",
    customer_name: "Vikram Singh",
    customer_email: "vikram.singh@example.com",
    items: [
      { name: "Red Bull Energy Drink 250ml", qty: 4, price: 125 },
      { name: "Cadbury Dairy Milk 160g", qty: 2, price: 85 },
    ],
    total_amount: 670,
    status: "cancelled",
    delivery_address: "23, MG Road, Bangalore 560001",
    created_at: "2024-01-19T16:45:00Z",
    delivered_at: null,
    notes: "Cancelled by customer — changed mind",
  },
  {
    id: "ORD-006",
    customer_name: "Ananya Gupta",
    customer_email: "ananya.gupta@example.com",
    items: [
      { name: "Colgate MaxFresh 150g", qty: 2, price: 115 },
      { name: "Dove Body Wash 200ml", qty: 1, price: 249 },
      { name: "Head & Shoulders 180ml", qty: 1, price: 199 },
    ],
    total_amount: 678,
    status: "delivered",
    delivery_address: "Tower C, Prestige Shantiniketan, Whitefield, Bangalore 560048",
    created_at: "2024-01-20T07:00:00Z",
    delivered_at: "2024-01-20T07:32:00Z",
    notes: null,
  },
  {
    id: "ORD-007",
    customer_name: "Rohit Mehra",
    customer_email: "rohit.mehra@example.com",
    items: [
      { name: "Nestlé Maggi Noodles 12-pack", qty: 1, price: 180 },
      { name: "Parle-G Biscuit 800g", qty: 2, price: 65 },
    ],
    total_amount: 310,
    status: "processing",
    delivery_address: "15, Civil Lines, Jaipur 302006",
    created_at: "2024-01-22T12:10:00Z",
    delivered_at: null,
    notes: null,
  },
  {
    id: "ORD-008",
    customer_name: "Deepika Nair",
    customer_email: "deepika.nair@example.com",
    items: [
      { name: "Fortune Sunflower Oil 5L", qty: 1, price: 699 },
      { name: "Toor Dal 1kg", qty: 2, price: 135 },
    ],
    total_amount: 969,
    status: "refunded",
    delivery_address: "22/B, Vashi Sector 17, Navi Mumbai 400703",
    created_at: "2024-01-15T09:30:00Z",
    delivered_at: "2024-01-15T10:15:00Z",
    notes: "Refund processed — wrong item delivered",
  },
  {
    id: "ORD-009",
    customer_name: "Karan Bajaj",
    customer_email: "karan.bajaj@example.com",
    items: [
      { name: "Tropicana Orange Juice 1L", qty: 2, price: 145 },
      { name: "Epigamia Greek Yogurt 90g", qty: 4, price: 40 },
    ],
    total_amount: 450,
    status: "delivered",
    delivery_address: "A-301, Powai Plaza, Mumbai 400076",
    created_at: "2024-01-21T06:15:00Z",
    delivered_at: "2024-01-21T06:52:00Z",
    notes: null,
  },
  {
    id: "ORD-010",
    customer_name: "Pooja Joshi",
    customer_email: "pooja.joshi@example.com",
    items: [
      { name: "Dettol Hand Sanitizer 500ml", qty: 2, price: 199 },
      { name: "Whisper Ultra Soft XL 30-pack", qty: 1, price: 329 },
    ],
    total_amount: 727,
    status: "pending",
    delivery_address: "D-9, Vasant Vihar, New Delhi 110057",
    created_at: "2024-01-22T15:30:00Z",
    delivered_at: null,
    notes: null,
  },
  {
    id: "ORD-011",
    customer_name: "Nikhil Verma",
    customer_email: "nikhil.verma@example.com",
    items: [
      { name: "Amul Butter 500g", qty: 1, price: 270 },
      { name: "Amul Cheese Slices 200g", qty: 2, price: 120 },
    ],
    total_amount: 510,
    status: "shipped",
    delivery_address: "7, Shivaji Nagar, Pune 411005",
    created_at: "2024-01-22T08:00:00Z",
    delivered_at: null,
    notes: null,
  },
  {
    id: "ORD-012",
    customer_name: "Ritu Agarwal",
    customer_email: "ritu.agarwal@example.com",
    items: [{ name: "Himalaya Face Wash 150ml", qty: 1, price: 175 }],
    total_amount: 175,
    status: "delivered",
    delivery_address: "303, Koramangala 5th Block, Bangalore 560095",
    created_at: "2024-01-20T11:20:00Z",
    delivered_at: "2024-01-20T11:58:00Z",
    notes: null,
  },
  {
    id: "ORD-013",
    customer_name: "Suresh Iyer",
    customer_email: "suresh.iyer@example.com",
    items: [
      { name: "Tata Salt 1kg", qty: 3, price: 28 },
      { name: "MDH Kitchen King Masala 100g", qty: 2, price: 85 },
      { name: "Everest Garam Masala 100g", qty: 1, price: 95 },
    ],
    total_amount: 349,
    status: "cancelled",
    delivery_address: "45, Anna Nagar, Chennai 600040",
    created_at: "2024-01-21T13:00:00Z",
    delivered_at: null,
    notes: "Cancelled — duplicate order",
  },
  {
    id: "ORD-014",
    customer_name: "Meera Krishnan",
    customer_email: "meera.krishnan@example.com",
    items: [
      { name: "Kissan Mixed Fruit Jam 700g", qty: 1, price: 199 },
      { name: "Horlicks Classic Malt 500g", qty: 1, price: 285 },
    ],
    total_amount: 484,
    status: "refund_requested",
    delivery_address: "12A, Jayanagar 4th Block, Bangalore 560041",
    created_at: "2024-01-17T10:30:00Z",
    delivered_at: "2024-01-17T11:15:00Z",
    notes: "Expiry date passed — customer requesting refund",
  },
  {
    id: "ORD-015",
    customer_name: "Arjun Malhotra",
    customer_email: "arjun.malhotra@example.com",
    items: [
      { name: "Lay's American Style Cream & Onion 164g", qty: 3, price: 40 },
      { name: "Kurkure Masala Munch 90g", qty: 4, price: 20 },
      { name: "Bingo! Mad Angles 90g", qty: 2, price: 20 },
    ],
    total_amount: 240,
    status: "delivered",
    delivery_address: "F-12, Connaught Place, New Delhi 110001",
    created_at: "2024-01-22T17:00:00Z",
    delivered_at: "2024-01-22T17:38:00Z",
    notes: null,
  },
  {
    id: "ORD-016",
    customer_name: "Kavita Saxena",
    customer_email: "kavita.saxena@example.com",
    items: [
      { name: "Johnson's Baby Powder 200g", qty: 1, price: 199 },
      { name: "Pampers Active Baby M 56-pack", qty: 1, price: 799 },
    ],
    total_amount: 998,
    status: "processing",
    delivery_address: "B-88, Sector 50, Gurugram 122018",
    created_at: "2024-01-22T09:45:00Z",
    delivered_at: null,
    notes: null,
  },
  {
    id: "ORD-017",
    customer_name: "Sachin Bansal",
    customer_email: "sachin.bansal@example.com",
    items: [{ name: "Godrej Aer Freshener 270ml", qty: 2, price: 229 }],
    total_amount: 458,
    status: "delivered",
    delivery_address: "Tower 4, Indiabulls Blu, Lower Parel, Mumbai 400013",
    created_at: "2024-01-19T07:30:00Z",
    delivered_at: "2024-01-19T08:12:00Z",
    notes: null,
  },
  {
    id: "ORD-018",
    customer_name: "Nisha Chawla",
    customer_email: "nisha.chawla@example.com",
    items: [
      { name: "Borges Olive Oil 500ml", qty: 1, price: 599 },
      { name: "Dr. Oetker Funfoods Mayonnaise 300g", qty: 1, price: 145 },
    ],
    total_amount: 744,
    status: "refunded",
    delivery_address: "H-7, Sector 30, Faridabad 121003",
    created_at: "2024-01-14T12:00:00Z",
    delivered_at: "2024-01-14T12:47:00Z",
    notes: "Item leaked during transit — full refund issued",
  },
  {
    id: "ORD-019",
    customer_name: "Gaurav Thakur",
    customer_email: "gaurav.thakur@example.com",
    items: [
      { name: "Gillette Mach3 Blades 8-pack", qty: 1, price: 399 },
      { name: "Nivea Men Face Wash 100ml", qty: 2, price: 149 },
    ],
    total_amount: 697,
    status: "shipped",
    delivery_address: "502, Pearl Apartments, Worli, Mumbai 400018",
    created_at: "2024-01-22T10:30:00Z",
    delivered_at: null,
    notes: null,
  },
  {
    id: "ORD-020",
    customer_name: "Tanvi Desai",
    customer_email: "tanvi.desai@example.com",
    items: [
      { name: "Dabur Chyawanprash 1kg", qty: 1, price: 385 },
      { name: "Patanjali Cow Ghee 1L", qty: 1, price: 545 },
      { name: "Saffola Gold Oil 5L", qty: 1, price: 849 },
    ],
    total_amount: 1779,
    status: "pending",
    delivery_address: "15, Prabhadevi, Mumbai 400025",
    created_at: "2024-01-22T16:00:00Z",
    delivered_at: null,
    notes: "High-value order — handle with care",
  },
];
