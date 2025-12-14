const express = require('express');
const multer = require('multer');
const compression = require('compression');
const helmet = require('helmet');
const sharp = require('sharp');
const slugify = require('slugify');
const { SitemapStream, streamToPromise } = require('sitemap');
const fs = require('fs').promises;
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      scriptSrcAttr: ["'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "https:", "http:"]
    }
  }
}));
app.use(compression());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));
app.use('/uploads', express.static('uploads'));
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

const storage = multer.diskStorage({
  destination: async (req, file, cb) => {
    const dir = './uploads';
    await fs.mkdir(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({ 
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) cb(null, true);
    else cb(new Error('Chỉ chấp nhận file ảnh!'));
  }
});

const readJSON = async (file) => {
  try {
    await fs.mkdir('./data', { recursive: true });
    const data = await fs.readFile(`./data/${file}`, 'utf8');
    return JSON.parse(data);
  } catch (err) {
    if (file === 'products.json') return [];
    if (file === 'categories.json') return [];
    if (file === 'posts.json') return [];
    if (file === 'settings.json') return {};
    return {};
  }
};

const writeJSON = async (file, data) => {
  await fs.mkdir('./data', { recursive: true });
  await fs.writeFile(`./data/${file}`, JSON.stringify(data, null, 2));
};

const generateSlug = (text) => {
  return text.toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd').replace(/Đ/g, 'D')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
};

function createSEOFilename(originalName, prefix = '') {
  const ext = path.extname(originalName);
  const name = path.basename(originalName, ext);
  const seoName = slugify(name, { lower: true, strict: true, locale: 'vi' });
  const timestamp = Date.now();
  return prefix ? `${prefix}-${seoName}-${timestamp}${ext}` : `${seoName}-${timestamp}${ext}`;
}

app.get('/', async (req, res) => {
  try {
    const products = await readJSON('products.json');
    const categories = await readJSON('categories.json');
    const settings = await readJSON('settings.json');
    res.render('index', {
      title: settings.siteTitle || 'Nội Thất Cao Cấp',
      description: settings.siteDescription || 'Chuyên cung cấp nội thất chất lượng cao',
      keywords: settings.keywords || 'nội thất, sofa, giường, tủ, bàn ghế',
      products: products.slice(0, 12),
      categories,
      settings,
      canonicalUrl: `${req.protocol}://${req.get('host')}${req.originalUrl}`,
      currentPath: req.path
    });
  } catch (error) {
    console.error('Error rendering homepage:', error);
    res.status(500).send('Lỗi server');
  }
});

app.get('/san-pham/:slug', async (req, res) => {
  try {
    const products = await readJSON('products.json');
    const categories = await readJSON('categories.json');
    const settings = await readJSON('settings.json');
    const product = products.find(p => p.slug === req.params.slug);
    if (!product) {
      return res.status(404).render('404', {
        title: 'Không tìm thấy sản phẩm - 404',
        description: 'Sản phẩm không tồn tại',
        categories,
        settings: {},
        currentPath: req.path
      });
    }
    const category = categories.find(c => c.id === product.categoryId);
    const relatedProducts = products.filter(p => p.categoryId === product.categoryId && p.id !== product.id).slice(0, 4);
    res.render('product', {
      title: `${product.name} - Nội Thất Cao Cấp`,
      description: product.description || `Mua ${product.name} chất lượng cao`,
      keywords: product.tags?.join(', ') || product.name,
      product, category, relatedProducts, categories, settings,
      canonicalUrl: `${req.protocol}://${req.get('host')}${req.originalUrl}`,
      currentPath: req.path,
      structuredData: {
        "@context": "https://schema.org",
        "@type": "Product",
        "name": product.name,
        "description": product.description,
        "image": product.images?.map(img => `${req.protocol}://${req.get('host')}${img}`),
        "offers": {
          "@type": "Offer",
          "price": product.price,
          "priceCurrency": "VND",
          "availability": "https://schema.org/InStock",
          "url": `${req.protocol}://${req.get('host')}${req.originalUrl}`
        },
        "brand": { "@type": "Brand", "name": "Nội Thất Cao Cấp" }
      }
    });
  } catch (error) {
    console.error('Error rendering product:', error);
    res.status(500).send('Lỗi server');
  }
});

app.get('/danh-muc/:slug', async (req, res) => {
  try {
    const products = await readJSON('products.json');
    const categories = await readJSON('categories.json');
    const settings = await readJSON('settings.json');
    const category = categories.find(c => c.slug === req.params.slug);
    if (!category) {
      return res.status(404).render('404', {
        title: 'Không tìm thấy danh mục - 404',
        description: 'Danh mục không tồn tại',
        categories,
        settings: {},
        currentPath: req.path
      });
    }
    const categoryProducts = products.filter(p => p.categoryId === category.id);
    res.render('category', {
      title: `${category.name} - Nội Thất Cao Cấp`,
      description: category.description || `Danh mục ${category.name}`,
      keywords: category.name,
      category, products: categoryProducts, categories, settings,
      canonicalUrl: `${req.protocol}://${req.get('host')}${req.originalUrl}`,
      currentPath: req.path
    });
  } catch (error) {
    console.error('Error rendering category:', error);
    res.status(500).send('Lỗi server');
  }
});

app.get('/blog', async (req, res) => {
  try {
    const posts = await readJSON('posts.json');
    const categories = await readJSON('categories.json');
    const settings = await readJSON('settings.json');
    const publishedPosts = posts.filter(p => p.published);
    res.render('blog', {
      title: 'Blog - Tin tức & Kiến thức Nội thất',
      description: 'Cập nhật tin tức mới nhất về nội thất',
      keywords: 'blog nội thất, tin tức nội thất',
      posts: publishedPosts, categories, settings,
      canonicalUrl: `${req.protocol}://${req.get('host')}${req.originalUrl}`,
      currentPath: req.path
    });
  } catch (error) {
    console.error('Error rendering blog:', error);
    res.status(500).send('Lỗi server');
  }
});

app.get('/blog/:slug', async (req, res) => {
  try {
    const posts = await readJSON('posts.json');
    const categories = await readJSON('categories.json');
    const settings = await readJSON('settings.json');
    const post = posts.find(p => p.slug === req.params.slug);
    if (!post || !post.published) {
      return res.status(404).render('404', {
        title: 'Không tìm thấy bài viết - 404',
        description: 'Bài viết không tồn tại',
        categories,
        settings: {},
        currentPath: req.path
      });
    }
    post.views = (post.views || 0) + 1;
    const postIndex = posts.findIndex(p => p.id === post.id);
    posts[postIndex].views = post.views;
    await writeJSON('posts.json', posts);
    const relatedPosts = posts.filter(p => p.published && p.id !== post.id && p.category === post.category).slice(0, 3);
    res.render('post', {
      title: post.metaTitle || `${post.title} | Blog`,
      description: post.metaDescription || post.excerpt,
      keywords: post.metaKeywords || post.tags?.join(', '),
      post, relatedPosts, categories, settings,
      canonicalUrl: `${req.protocol}://${req.get('host')}${req.originalUrl}`,
      currentPath: req.path,
      structuredData: {
        "@context": "https://schema.org",
        "@type": "BlogPosting",
        "headline": post.title,
        "description": post.excerpt,
        "author": { "@type": "Person", "name": post.author },
        "datePublished": post.createdAt,
        "dateModified": post.updatedAt,
        "image": post.featuredImage ? `${req.protocol}://${req.get('host')}${post.featuredImage}` : null
      }
    });
  } catch (error) {
    console.error('Error rendering post:', error);
    res.status(500).send('Lỗi server');
  }
});

app.get('/sitemap.xml', async (req, res) => {
  try {
    const products = await readJSON('products.json');
    const categories = await readJSON('categories.json');
    const posts = await readJSON('posts.json');
    const smStream = new SitemapStream({ hostname: `${req.protocol}://${req.get('host')}` });
    smStream.write({ url: '/', changefreq: 'daily', priority: 1.0 });
    smStream.write({ url: '/blog', changefreq: 'daily', priority: 0.9 });
    categories.forEach(cat => {
      smStream.write({ url: `/danh-muc/${cat.slug}`, changefreq: 'weekly', priority: 0.8 });
    });
    products.forEach(prod => {
      smStream.write({ url: `/san-pham/${prod.slug}`, changefreq: 'monthly', priority: 0.6 });
    });
    posts.filter(p => p.published).forEach(post => {
      smStream.write({ url: `/blog/${post.slug}`, changefreq: 'monthly', priority: 0.7 });
    });
    smStream.end();
    const sitemap = await streamToPromise(smStream);
    res.header('Content-Type', 'application/xml');
    res.send(sitemap);
  } catch (error) {
    console.error('Error generating sitemap:', error);
    res.status(500).send('Lỗi tạo sitemap');
  }
});

app.get('/robots.txt', (req, res) => {
  res.type('text/plain');
  res.send(`User-agent: *\nAllow: /\nDisallow: /admin/\nDisallow: /api/\nSitemap: ${req.protocol}://${req.get('host')}/sitemap.xml`);
});

app.get('/api/products', async (req, res) => {
  try {
    const products = await readJSON('products.json');
    res.json(products);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/products', upload.array('images', 10), async (req, res) => {
  try {
    const products = await readJSON('products.json');
    const id = Date.now().toString();
    const images = req.files ? await Promise.all(
      req.files.map(async (file) => {
        const optimizedPath = `/uploads/optimized-${file.filename}`;
        await sharp(file.path).resize(800, 800, { fit: 'inside' }).jpeg({ quality: 85 }).toFile(`./uploads/optimized-${file.filename}`);
        return optimizedPath;
      })
    ) : [];
    const features = req.body.features ? req.body.features.split('\n').filter(f => f.trim()) : [];
    const tags = req.body.tags ? req.body.tags.split(',').map(t => t.trim()).filter(t => t) : [];
    const product = {
      id, name: req.body.name, slug: generateSlug(req.body.name),
      description: req.body.description, shortDescription: req.body.shortDescription,
      price: parseInt(req.body.price), oldPrice: req.body.oldPrice ? parseInt(req.body.oldPrice) : null,
      discount: req.body.oldPrice ? Math.round((1 - parseInt(req.body.price) / parseInt(req.body.oldPrice)) * 100) : 0,
      categoryId: req.body.categoryId, images, sku: req.body.sku || `PRD${id}`,
      isNew: req.body.isNew === 'true', tags, features,
      specifications: req.body.specifications ? JSON.parse(req.body.specifications) : {},
      createdAt: new Date().toISOString(), updatedAt: new Date().toISOString()
    };
    products.push(product);
    await writeJSON('products.json', products);
    res.json(product);
  } catch (error) {
    console.error('Error creating product:', error);
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/products/:id', upload.array('images', 10), async (req, res) => {
  try {
    const products = await readJSON('products.json');
    const index = products.findIndex(p => p.id === req.params.id);
    if (index === -1) return res.status(404).json({ error: 'Không tìm thấy sản phẩm' });
    const newImages = req.files ? await Promise.all(
      req.files.map(async (file) => {
        const optimizedPath = `/uploads/optimized-${file.filename}`;
        await sharp(file.path).resize(800, 800, { fit: 'inside' }).jpeg({ quality: 85 }).toFile(`./uploads/optimized-${file.filename}`);
        return optimizedPath;
      })
    ) : [];
    const existingImages = JSON.parse(req.body.existingImages || '[]');
    const images = [...existingImages, ...newImages];
    const features = req.body.features ? req.body.features.split('\n').filter(f => f.trim()) : [];
    const tags = req.body.tags ? req.body.tags.split(',').map(t => t.trim()).filter(t => t) : [];
    products[index] = {
      ...products[index],
      name: req.body.name, slug: generateSlug(req.body.name),
      description: req.body.description, shortDescription: req.body.shortDescription,
      price: parseInt(req.body.price), oldPrice: req.body.oldPrice ? parseInt(req.body.oldPrice) : null,
      discount: req.body.oldPrice ? Math.round((1 - parseInt(req.body.price) / parseInt(req.body.oldPrice)) * 100) : 0,
      categoryId: req.body.categoryId, images, sku: req.body.sku,
      isNew: req.body.isNew === 'true', tags, features,
      specifications: req.body.specifications ? JSON.parse(req.body.specifications) : {},
      updatedAt: new Date().toISOString()
    };
    await writeJSON('products.json', products);
    res.json(products[index]);
  } catch (error) {
    console.error('Error updating product:', error);
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/products/:id', async (req, res) => {
  try {
    const products = await readJSON('products.json');
    const filtered = products.filter(p => p.id !== req.params.id);
    await writeJSON('products.json', filtered);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/categories', async (req, res) => {
  try {
    const categories = await readJSON('categories.json');
    res.json(categories);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/categories', async (req, res) => {
  try {
    const categories = await readJSON('categories.json');
    const category = {
      id: Date.now().toString(),
      name: req.body.name,
      slug: generateSlug(req.body.name),
      description: req.body.description,
      icon: req.body.icon || '',
      image: req.body.image || ''
    };
    categories.push(category);
    await writeJSON('categories.json', categories);
    res.json(category);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/categories/:id', async (req, res) => {
  try {
    const categories = await readJSON('categories.json');
    const index = categories.findIndex(c => c.id === req.params.id);
    if (index === -1) return res.status(404).json({ error: 'Không tìm thấy danh mục' });
    categories[index] = {
      ...categories[index],
      name: req.body.name,
      slug: generateSlug(req.body.name),
      description: req.body.description,
      icon: req.body.icon || categories[index].icon,
      image: req.body.image || categories[index].image
    };
    await writeJSON('categories.json', categories);
    res.json(categories[index]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/categories/:id', async (req, res) => {
  try {
    const categories = await readJSON('categories.json');
    const filtered = categories.filter(c => c.id !== req.params.id);
    await writeJSON('categories.json', filtered);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/posts', async (req, res) => {
  try {
    const posts = await readJSON('posts.json');
    res.json(posts);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/posts', upload.single('featuredImage'), async (req, res) => {
  try {
    const posts = await readJSON('posts.json');
    const id = Date.now().toString();
    let featuredImage = null;
    if (req.file) {
      const optimizedPath = `/uploads/optimized-${req.file.filename}`;
      await sharp(req.file.path).resize(1200, 630, { fit: 'cover' }).jpeg({ quality: 85 }).toFile(`./uploads/optimized-${req.file.filename}`);
      featuredImage = optimizedPath;
    }
    const tags = req.body.tags ? req.body.tags.split(',').map(t => t.trim()).filter(t => t) : [];
    const post = {
      id, title: req.body.title, slug: generateSlug(req.body.title),
      excerpt: req.body.excerpt, content: req.body.content, featuredImage,
      author: req.body.author || 'Admin', category: req.body.category, tags,
      metaTitle: req.body.metaTitle || req.body.title,
      metaDescription: req.body.metaDescription || req.body.excerpt,
      metaKeywords: req.body.metaKeywords, published: req.body.published === 'true',
      views: 0, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString()
    };
    posts.push(post);
    await writeJSON('posts.json', posts);
    res.json(post);
  } catch (error) {
    console.error('Error creating post:', error);
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/posts/:id', upload.single('featuredImage'), async (req, res) => {
  try {
    const posts = await readJSON('posts.json');
    const index = posts.findIndex(p => p.id === req.params.id);
    if (index === -1) return res.status(404).json({ error: 'Không tìm thấy bài viết' });
    let featuredImage = req.body.existingImage || posts[index].featuredImage;
    if (req.file) {
      const optimizedPath = `/uploads/optimized-${req.file.filename}`;
      await sharp(req.file.path).resize(1200, 630, { fit: 'cover' }).jpeg({ quality: 85 }).toFile(`./uploads/optimized-${req.file.filename}`);
      featuredImage = optimizedPath;
    }
    const tags = req.body.tags ? req.body.tags.split(',').map(t => t.trim()).filter(t => t) : [];
    posts[index] = {
      ...posts[index],
      title: req.body.title, slug: generateSlug(req.body.title),
      excerpt: req.body.excerpt, content: req.body.content, featuredImage,
      author: req.body.author || 'Admin', category: req.body.category, tags,
      metaTitle: req.body.metaTitle || req.body.title,
      metaDescription: req.body.metaDescription || req.body.excerpt,
      metaKeywords: req.body.metaKeywords, published: req.body.published === 'true',
      updatedAt: new Date().toISOString()
    };
    await writeJSON('posts.json', posts);
    res.json(posts[index]);
  } catch (error) {
    console.error('Error updating post:', error);
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/posts/:id', async (req, res) => {
  try {
    const posts = await readJSON('posts.json');
    const filtered = posts.filter(p => p.id !== req.params.id);
    await writeJSON('posts.json', filtered);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/settings', async (req, res) => {
  try {
    const settings = await readJSON('settings.json');
    res.json(settings);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/settings', async (req, res) => {
  try {
    await writeJSON('settings.json', req.body);
    res.json(req.body);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/seo-check', async (req, res) => {
  const { title, description, keywords, content, images } = req.body;
  const checks = [];
  let total = 0;
  if (title && title.length >= 30 && title.length <= 60) {
    checks.push({ name: 'Title Length', status: 'pass', points: 15, message: `${title.length} ký tự - Tốt!` });
    total += 15;
  } else {
    checks.push({ name: 'Title Length', status: 'fail', points: 0, message: `${title?.length || 0} ký tự. Nên 30-60 ký tự` });
  }
  if (description && description.length >= 120 && description.length <= 160) {
    checks.push({ name: 'Meta Description', status: 'pass', points: 15, message: `${description.length} ký tự - Tốt!` });
    total += 15;
  } else {
    checks.push({ name: 'Meta Description', status: 'fail', points: 0, message: `${description?.length || 0} ký tự. Nên 120-160 ký tự` });
  }
  const keywordList = keywords ? keywords.split(',').map(k => k.trim()).filter(k => k) : [];
  if (keywordList.length >= 3) {
    checks.push({ name: 'Keywords', status: 'pass', points: 10, message: `${keywordList.length} keywords` });
    total += 10;
  } else {
    checks.push({ name: 'Keywords', status: 'warning', points: 5, message: `${keywordList.length} keywords. Nên có ít nhất 3` });
    total += 5;
  }
  const wordCount = content ? content.split(/\s+/).length : 0;
  if (wordCount >= 300) {
    checks.push({ name: 'Content Length', status: 'pass', points: 20, message: `${wordCount} từ - Tốt!` });
    total += 20;
  } else if (wordCount >= 150) {
    checks.push({ name: 'Content Length', status: 'warning', points: 10, message: `${wordCount} từ. Nên >= 300 từ` });
    total += 10;
  } else {
    checks.push({ name: 'Content Length', status: 'fail', points: 0, message: `Chỉ có ${wordCount} từ. Nên >= 300 từ` });
  }
  if (content && /<h1[^>]*>/.test(content)) {
    checks.push({ name: 'H1 Tag', status: 'pass', points: 10, message: 'Có H1 tag' });
    total += 10;
  } else {
    checks.push({ name: 'H1 Tag', status: 'fail', points: 0, message: 'Thiếu H1 tag' });
  }
  const imageCount = images?.length || 0;
  if (imageCount >= 3) {
    checks.push({ name: 'Images', status: 'pass', points: 10, message: `${imageCount} ảnh` });
    total += 10;
  } else if (imageCount >= 1) {
    checks.push({ name: 'Images', status: 'warning', points: 5, message: `${imageCount} ảnh. Nên có >= 3 ảnh` });
    total += 5;
  } else {
    checks.push({ name: 'Images', status: 'fail', points: 0, message: 'Không có ảnh' });
  }
  const imgsWithAlt = images?.filter(img => img.alt && img.alt.trim()).length || 0;
  if (imageCount === 0 || imgsWithAlt === imageCount) {
    checks.push({ name: 'Image Alt Text', status: 'pass', points: 10, message: 'Tất cả ảnh có alt text' });
    total += 10;
  } else {
    checks.push({ name: 'Image Alt Text', status: 'warning', points: Math.round((imgsWithAlt / imageCount) * 10), message: `${imgsWithAlt}/${imageCount} ảnh có alt text` });
    total += Math.round((imgsWithAlt / imageCount) * 10);
  }
  const linkCount = content ? (content.match(/<a[^>]+href/g) || []).length : 0;
  if (linkCount >= 3) {
    checks.push({ name: 'Internal Links', status: 'pass', points: 10, message: `${linkCount} links` });
    total += 10;
  } else if (linkCount >= 1) {
    checks.push({ name: 'Internal Links', status: 'warning', points: 5, message: `${linkCount} links. Nên có >= 3 links` });
    total += 5;
  } else {
    checks.push({ name: 'Internal Links', status: 'fail', points: 0, message: 'Không có internal links' });
  }
  const grade = total >= 95 ? 'A+' : total >= 85 ? 'A' : total >= 75 ? 'B+' : total >= 65 ? 'B' : total >= 55 ? 'C' : 'D';
  res.json({ total, checks, grade, maxScore: 100 });
});

app.get('/api/stats', async (req, res) => {
  try {
    const products = await readJSON('products.json');
    const categories = await readJSON('categories.json');
    const posts = await readJSON('posts.json');
    res.json({
      totalProducts: products.length,
      totalCategories: categories.length,
      totalPosts: posts.length,
      recentProducts: products.slice(-5).reverse()
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/upload/hero', upload.single('heroImage'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file' });
    const seoFilename = createSEOFilename(req.file.originalname, 'hero-banner');
    const outputPath = `./uploads/${seoFilename}`;
    await sharp(req.file.path).resize(1920, 600, { fit: 'cover' }).jpeg({ quality: 85 }).toFile(outputPath);
    await fs.unlink(req.file.path);
    res.json({ path: `/uploads/${seoFilename}` });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/upload/icon/:type', upload.single('icon'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file' });
    const iconType = req.params.type;
    const seoFilename = createSEOFilename(req.file.originalname, `icon-${iconType}`);
    const outputPath = `./uploads/${seoFilename}`;
    await sharp(req.file.path).resize(64, 64, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toFile(outputPath);
    await fs.unlink(req.file.path);
    res.json({ path: `/uploads/${seoFilename}` });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/upload/category', upload.single('categoryImage'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file' });
    const categoryName = req.body.categoryName || 'category';
    const seoFilename = createSEOFilename(categoryName + '-' + req.file.originalname, 'danh-muc');
    const outputPath = `./uploads/${seoFilename}`;
    await sharp(req.file.path).resize(800, 600, { fit: 'cover' }).jpeg({ quality: 85 }).toFile(outputPath);
    await fs.unlink(req.file.path);
    res.json({ path: `/uploads/${seoFilename}` });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/upload/company', upload.single('companyImage'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file' });
    const seoFilename = createSEOFilename(req.file.originalname, 'company');
    const outputPath = `./uploads/${seoFilename}`;
    await sharp(req.file.path).resize(600, 400, { fit: 'cover' }).jpeg({ quality: 85 }).toFile(outputPath);
    await fs.unlink(req.file.path);
    res.json({ path: `/uploads/${seoFilename}` });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/upload', upload.single('image'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file' });
    const seoFilename = createSEOFilename(req.file.originalname, 'product');
    const outputPath = `./uploads/${seoFilename}`;
    await sharp(req.file.path).resize(800, 800, { fit: 'inside' }).jpeg({ quality: 85 }).toFile(outputPath);
    await fs.unlink(req.file.path);
    res.json({ url: `/uploads/${seoFilename}` });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.use((req, res) => {
  res.status(404).render('404', {
    title: 'Không tìm thấy trang - 404',
    description: 'Trang bạn tìm không tồn tại',
    categories: [],
    settings: {},
    currentPath: req.path
  });
});

app.use((err, req, res, next) => {
  console.error('Server error:', err);
  res.status(500).send('Lỗi server');
});

app.listen(PORT, async () => {
  await fs.mkdir('./data', { recursive: true });
  await fs.mkdir('./uploads', { recursive: true });
  await fs.mkdir('./public/admin', { recursive: true });
  try {
    await fs.access('./data/settings.json');
  } catch {
    const sampleSettings = {
      "siteTitle": "Nội Thất Cao Cấp - Thiết Kế Hiện Đại",
      "siteDescription": "Chuyên cung cấp nội thất cao cấp",
      "keywords": "nội thất, sofa, giường ngủ",
      "author": "Nội Thất Cao Cấp",
      "phone": "0123456789",
      "email": "info@noithat.vn",
      "address": "Hà Nội, Việt Nam",
      "heroTitle": "Nội Thất Cao Cấp",
      "heroSubtitle": "Thiết kế đẳng cấp, chất lượng vượt trội",
      "heroDescription": "Khám phá bộ sưu tập nội thất hiện đại, sang trọng cho ngôi nhà của bạn",
      "heroImage": "",
      "showFloatingButtons": true,
      "floatingPhone": "0123456789",
      "floatingZalo": "0123456789",
      "floatingFacebook": "https://facebook.com/yourpage",
      "phoneIcon": "",
      "zaloIcon": "",
      "facebookIcon": "",
      "companyImage": "",
      "officeAddress": "123 Đường ABC, Quận 1, TP.HCM",
      "workingHours": "8:00 - 22:00 (Hàng ngày)",
      "mapLink": "",
      "staff1Name": "Mr. Nguyễn Văn A",
      "staff1Title": "Phòng Kinh Doanh",
      "staff1Phone": "090 123 4567",
      "staff2Name": "Mr. Trần Văn B",
      "staff2Title": "Phòng Thiết Kế",
      "staff2Phone": "090 987 6543"
    };
    await writeJSON('settings.json', sampleSettings);
  }
  console.log(`Server: http://localhost:${PORT}`);
  console.log(`Admin:  http://localhost:${PORT}/admin/admin.html`);
});