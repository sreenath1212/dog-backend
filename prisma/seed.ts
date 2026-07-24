import { PrismaClient, Category } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...');

  // Create admin user
  const adminHash = await bcrypt.hash('Admin@123', 12);
  const admin = await prisma.user.upsert({
    where: { email: 'admin@pawshop.com' },
    update: {},
    create: {
      email: 'admin@pawshop.com',
      name: 'PawShop Admin',
      passwordHash: adminHash,
      role: 'ADMIN',
      isEmailVerified: true,
    },
  });
  console.log(`✅ Admin user: ${admin.email}`);

  // Create sample customer
  const userHash = await bcrypt.hash('User@123456', 12);
  const customer = await prisma.user.upsert({
    where: { email: 'customer@example.com' },
    update: {},
    create: {
      email: 'customer@example.com',
      name: 'Jane Dog Lover',
      passwordHash: userHash,
      role: 'USER',
      isEmailVerified: true,
    },
  });
  console.log(`✅ Customer user: ${customer.email}`);

  // Sample products
  const products = [
    {
      name: 'Royal Canin Adult Maxi 4kg',
      slug: 'royal-canin-adult-maxi-4kg',
      description: 'Complete dry food for adult large breed dogs (26-44kg). Specially formulated to support healthy digestion, skin, and coat. Made with high-quality proteins and precise nutrient levels.',
      price: 249900, // ₹2499 in paise
      compareAtPrice: 299900,
      category: Category.FOOD,
      brand: 'Royal Canin',
      tags: ['dry food', 'adult', 'large breed', 'maxi'],
      stockQty: 45,
      images: ['royal_canin_adult.png', 'royal_canin_label.png'],
    },
    {
      name: 'Pedigree Adult Chicken & Vegetables 3kg',
      slug: 'pedigree-adult-chicken-vegetables-3kg',
      description: 'Complete nutrition for adult dogs with real chicken and vegetables. Supports strong bones and muscles, healthy digestion, and a shiny coat.',
      price: 89900,
      compareAtPrice: 109900,
      category: Category.FOOD,
      brand: 'Pedigree',
      tags: ['dry food', 'adult', 'chicken', 'vegetables'],
      stockQty: 80,
      images: ['pedigree_adult_chicken.png'],
    },
    {
      name: 'Heads Up For Tails Leather Leash',
      slug: 'hfft-leather-leash',
      description: 'Premium full-grain leather leash with solid brass hardware. 4-foot length, 3/4-inch width. Durable, comfortable grip that gets better with age.',
      price: 159900,
      compareAtPrice: null,
      category: Category.ACCESSORIES,
      brand: 'Heads Up For Tails',
      tags: ['leash', 'leather', 'premium', 'brass'],
      stockQty: 30,
      images: ['hfft_leather_leash.png'],
    },
    {
      name: 'Ruffwear Front Range Harness',
      slug: 'ruffwear-front-range-harness',
      description: 'Everyday harness for dogs who love the outdoors. Two leash attachment points (front and back), four points of adjustment for a custom fit, and padded chest and belly panels for all-day comfort.',
      price: 449900,
      compareAtPrice: 499900,
      category: Category.ACCESSORIES,
      brand: 'Ruffwear',
      tags: ['harness', 'outdoor', 'padded', 'adjustable'],
      stockQty: 20,
      images: ['ruffwear_harness.png', 'ruffwear_action.png'],
    },
    {
      name: 'Kong Classic Chew Toy - Large',
      slug: 'kong-classic-chew-toy-large',
      description: 'The iconic rubber toy for power chewers. Stuff with treats or peanut butter for hours of enrichment. Dishwasher safe, made from natural rubber. Suitable for dogs 30-65 lbs.',
      price: 79900,
      compareAtPrice: null,
      category: Category.TOYS,
      brand: 'Kong',
      tags: ['chew toy', 'rubber', 'treat dispenser', 'enrichment'],
      stockQty: 60,
      images: ['kong_classic_toy.png', 'kong_stuffed.png'],
    },
    {
      name: 'Chuckit! Ultra Ball (2-pack)',
      slug: 'chuckit-ultra-ball-2pack',
      description: 'High bounce rubber ball that floats in water. Compatible with all Chuckit launchers. Extra durable for enthusiastic fetchers. Large size (2.5 inch).',
      price: 59900,
      compareAtPrice: null,
      category: Category.TOYS,
      brand: 'Chuckit',
      tags: ['fetch', 'ball', 'rubber', 'water', 'floats'],
      stockQty: 75,
      images: ['chuckit_ultra_ball.png'],
    },
    {
      name: 'Wahl Oatmeal Shampoo 709ml',
      slug: 'wahl-oatmeal-shampoo',
      description: 'Coconut lime verbena scented shampoo with colloidal oatmeal. Cleans, conditions, detangles, and moisturizes. Plant-derived, pH balanced, alcohol-free. Safe for puppies over 6 weeks.',
      price: 124900,
      compareAtPrice: 149900,
      category: Category.GROOMING,
      brand: 'Wahl',
      tags: ['shampoo', 'oatmeal', 'sensitive skin', 'moisturizing'],
      stockQty: 40,
      images: ['wahl_oatmeal_shampoo.png', 'wahl_bath.png'],
    },
    {
      name: 'Hertzko Self-Cleaning Slicker Brush',
      slug: 'hertzko-self-cleaning-slicker-brush',
      description: 'Fine bent wire bristles gently remove loose hair, tangles, knots, and dirt. Self-cleaning mechanism retracts bristles for easy hair removal. Comfortable grip handle.',
      price: 94900,
      compareAtPrice: null,
      category: Category.GROOMING,
      brand: 'Hertzko',
      tags: ['brush', 'self-cleaning', 'deshedding', 'grooming'],
      stockQty: 35,
      images: ['hertzko_slicker_brush.png'],
    },
    {
      name: 'NexGard Chewables for Dogs (3 Tablets)',
      slug: 'nexgard-chewables-3pack',
      description: 'Beef-flavoured monthly chewable for flea and tick prevention. Kills fleas before they can lay eggs. Prescription-strength protection available OTC. For dogs 4-10kg.',
      price: 129900,
      compareAtPrice: null,
      category: Category.HEALTH,
      brand: 'NexGard',
      tags: ['flea', 'tick', 'prevention', 'chewable', 'monthly'],
      stockQty: 25,
      images: ['nexgard_chewables.png'],
    },
    {
      name: 'Himalaya Liver Tonic for Dogs 200ml',
      slug: 'himalaya-liver-tonic-dogs',
      description: 'Herbal liver supplement that supports liver function, improves appetite, and aids in digestion. Contains Kutki, Kasani, Mandur Bhasma. Safe for daily use.',
      price: 34900,
      compareAtPrice: null,
      category: Category.HEALTH,
      brand: 'Himalaya',
      tags: ['liver', 'supplement', 'herbal', 'digestion', 'appetite'],
      stockQty: 50,
      images: ['himalaya_liver_tonic.png'],
    },
  ];

  for (const product of products) {
    await prisma.product.upsert({
      where: { slug: product.slug },
      update: {
        images: product.images,
      },
      create: product,
    });
  }

  console.log(`✅ Seeded ${products.length} products`);
  console.log('\n🎉 Seed complete!');
  console.log('Admin login: admin@pawshop.com / Admin@123');
  console.log('Customer login: customer@example.com / User@123456');
}

main()
  .catch((e) => {
    console.error('Seed failed:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
