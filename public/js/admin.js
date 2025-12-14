// ============================================
// FURNITURE CMS - ADMIN PANEL JAVASCRIPT
// Version 2.0 - Đầy đủ tính năng
// ============================================

// ==================== GLOBAL VARIABLES ====================
let products = [];
let categories = [];
let settings = {};
let posts = [];

let currentProduct = null;
let currentPost = null;

let uploadedImages = [];
let postFeaturedImage = '';

// ==================== INITIALIZATION ====================
document.addEventListener('DOMContentLoaded', () => {
  loadDashboard();
  setupEventListeners();
});

function setupEventListeners() {
  // Navigation
  document.querySelectorAll('.nav-item').forEach(item => {
    item.addEventListener('click', (e) => {
      if (!item.hasAttribute('target')) {
        e.preventDefault();
        const page = item.dataset.page;
        if (page) switchPage(page);
      }
    });
  });

  // Product Buttons
  const addProductBtn = document.getElementById('addProductBtn');
  if (addProductBtn) {
    addProductBtn.addEventListener('click', openProductModal);
  }
  
  // Category Button
  const addCategoryBtn = document.getElementById('addCategoryBtn');
  if (addCategoryBtn) {
    addCategoryBtn.addEventListener('click', openCategoryModal);
  }

  // Post Button
  const addPostBtn = document.getElementById('addPostBtn');
  if (addPostBtn) {
    addPostBtn.addEventListener('click', openPostModal);
  }

  // Forms
  document.getElementById('productForm').addEventListener('submit', saveProduct);
  document.getElementById('categoryForm').addEventListener('submit', saveCategory);
  document.getElementById('settingsForm').addEventListener('submit', saveSettings);
  
  const postForm = document.getElementById('postForm');
  if (postForm) {
    postForm.addEventListener('submit', savePost);
  }

  // Image Uploads
  document.getElementById('productImages').addEventListener('change', handleImageUpload);
  
  const postImageInput = document.getElementById('postFeaturedImage');
  if (postImageInput) {
    postImageInput.addEventListener('change', handlePostImageUpload);
  }

  // Search
  const searchInput = document.getElementById('searchProducts');
  if (searchInput) {
    searchInput.addEventListener('input', (e) => filterProducts(e.target.value));
  }
}

// ==================== PAGE SWITCHING ====================
function switchPage(pageName) {
  // Hide all pages
  document.querySelectorAll('.page').forEach(p => p.style.display = 'none');
  
  // Show selected page
  const selectedPage = document.getElementById(`${pageName}-page`);
  if (selectedPage) {
    selectedPage.style.display = 'block';
  }
  
  // Update navigation
  document.querySelectorAll('.nav-item').forEach(item => {
    item.classList.remove('active');
    if (item.dataset.page === pageName) {
      item.classList.add('active');
    }
  });
  
  // Update page title
  const titles = {
    dashboard: 'Dashboard',
    products: 'Quản lý sản phẩm',
    categories: 'Quản lý danh mục',
    posts: 'Quản lý bài viết',
    settings: 'Cài đặt SEO'
  };
  document.getElementById('pageTitle').textContent = titles[pageName] || 'Admin Panel';
  
  // Show/hide add product button
  const addBtn = document.getElementById('addProductBtn');
  if (addBtn) {
    addBtn.style.display = pageName === 'products' ? 'block' : 'none';
  }
  
  // Load data for the page
  switch(pageName) {
    case 'dashboard':
      loadDashboard();
      break;
    case 'products':
      loadProducts();
      break;
    case 'categories':
      loadCategories();
      break;
    case 'posts':
      loadPosts();
      break;
    case 'settings':
      loadSettings();
      break;
  }
}

// ==================== DASHBOARD ====================
async function loadDashboard() {
  try {
    const [productsRes, categoriesRes, postsRes] = await Promise.all([
      fetch('/api/products'),
      fetch('/api/categories'),
      fetch('/api/posts').catch(() => ({ json: () => [] }))
    ]);
    
    products = await productsRes.json();
    categories = await categoriesRes.json();
    posts = await postsRes.json();
    
    document.getElementById('totalProducts').textContent = products.length;
    document.getElementById('totalCategories').textContent = categories.length;
    
    // Show recent products
    const recentProducts = products.slice(-5).reverse();
    const recentList = document.getElementById('recentProductsList');
    if (recentList) {
      recentList.innerHTML = recentProducts.map(p => `
        <div style="padding: 1rem; border-bottom: 1px solid var(--border); display: flex; justify-content: space-between; align-items: center;">
          <div>
            <strong>${p.name}</strong>
            <div style="font-size: 0.875rem; color: var(--text-light);">
              ${p.price?.toLocaleString('vi-VN')}đ
            </div>
          </div>
          <button class="btn btn-sm btn-primary" onclick="editProduct('${p.id}')">
            ✏️ Sửa
          </button>
        </div>
      `).join('');
    }
  } catch (error) {
    console.error('Error loading dashboard:', error);
    showToast('Lỗi tải dashboard', 'error');
  }
}

// ==================== PRODUCTS MANAGEMENT ====================
async function loadProducts() {
  try {
    const res = await fetch('/api/products');
    products = await res.json();
    
    const categoriesRes = await fetch('/api/categories');
    categories = await categoriesRes.json();
    
    renderProductsTable(products);
  } catch (error) {
    console.error('Error loading products:', error);
    showToast('Lỗi tải sản phẩm', 'error');
  }
}

function renderProductsTable(productsToRender) {
  const tbody = document.getElementById('productsTableBody');
  
  if (productsToRender.length === 0) {
    tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; padding: 2rem;">Chưa có sản phẩm nào</td></tr>';
    return;
  }
  
  tbody.innerHTML = productsToRender.map(p => {
    const category = categories.find(c => c.id === p.categoryId);
    const seoScore = calculateQuickSEO(p);
    const gradeClass = seoScore >= 85 ? 'grade-a' : seoScore >= 70 ? 'grade-b' : seoScore >= 50 ? 'grade-c' : 'grade-d';
    
    return `
      <tr>
        <td>
          <img src="${p.images?.[0] || '/images/placeholder.jpg'}" alt="${p.name}" class="product-img">
        </td>
        <td>
          <strong>${p.name}</strong>
          <div style="font-size: 0.75rem; color: var(--text-light);">SKU: ${p.sku || 'N/A'}</div>
        </td>
        <td>${p.price?.toLocaleString('vi-VN')}đ</td>
        <td>${category?.name || 'N/A'}</td>
        <td>
          <span class="seo-badge ${gradeClass}">${seoScore}/100</span>
        </td>
        <td>
          <button class="btn btn-sm btn-primary" onclick="editProduct('${p.id}')">✏️</button>
          <button class="btn btn-sm btn-danger" onclick="deleteProduct('${p.id}')">🗑️</button>
        </td>
      </tr>
    `;
  }).join('');
}

function filterProducts(query) {
  const filtered = products.filter(p => 
    p.name.toLowerCase().includes(query.toLowerCase()) ||
    p.description?.toLowerCase().includes(query.toLowerCase())
  );
  renderProductsTable(filtered);
}

function calculateQuickSEO(product) {
  let score = 0;
  
  if (product.name && product.name.length >= 30 && product.name.length <= 60) score += 15;
  if (product.description && product.description.length >= 120) score += 20;
  if (product.tags && product.tags.length >= 3) score += 10;
  if (product.images && product.images.length >= 1) score += 15;
  if (product.price) score += 10;
  if (product.categoryId) score += 10;
  if (product.features && product.features.length > 0) score += 10;
  if (product.shortDescription) score += 10;
  
  return score;
}

function openProductModal() {
  currentProduct = null;
  uploadedImages = [];
  document.getElementById('productForm').reset();
  document.getElementById('productId').value = '';
  document.getElementById('productModalTitle').textContent = 'Thêm sản phẩm mới';
  document.getElementById('imagePreview').innerHTML = '';
  document.getElementById('seoScoreBox').style.display = 'none';
  
  loadCategoryOptions();
  
  document.getElementById('productModal').classList.add('active');
}

async function editProduct(id) {
  currentProduct = products.find(p => p.id === id);
  if (!currentProduct) return;
  
  document.getElementById('productId').value = currentProduct.id;
  document.getElementById('productName').value = currentProduct.name;
  document.getElementById('productSku').value = currentProduct.sku || '';
  document.getElementById('productPrice').value = currentProduct.price;
  document.getElementById('productOldPrice').value = currentProduct.oldPrice || '';
  document.getElementById('productCategory').value = currentProduct.categoryId;
  document.getElementById('productShortDesc').value = currentProduct.shortDescription || '';
  document.getElementById('productDescription').value = currentProduct.description;
  document.getElementById('productFeatures').value = currentProduct.features?.join('\n') || '';
  document.getElementById('productTags').value = currentProduct.tags?.join(', ') || '';
  document.getElementById('productIsNew').checked = currentProduct.isNew || false;
  
  uploadedImages = currentProduct.images || [];
  renderImagePreviews();
  
  document.getElementById('productModalTitle').textContent = 'Sửa sản phẩm';
  loadCategoryOptions();
  
  document.getElementById('productModal').classList.add('active');
}

function closeProductModal() {
  document.getElementById('productModal').classList.remove('active');
  currentProduct = null;
  uploadedImages = [];
}

async function saveProduct(e) {
  e.preventDefault();
  
  const productData = {
    name: document.getElementById('productName').value,
    sku: document.getElementById('productSku').value,
    price: parseFloat(document.getElementById('productPrice').value),
    oldPrice: parseFloat(document.getElementById('productOldPrice').value) || null,
    categoryId: document.getElementById('productCategory').value,
    shortDescription: document.getElementById('productShortDesc').value,
    description: document.getElementById('productDescription').value,
    features: document.getElementById('productFeatures').value.split('\n').filter(f => f.trim()),
    tags: document.getElementById('productTags').value.split(',').map(t => t.trim()).filter(t => t),
    isNew: document.getElementById('productIsNew').checked,
    images: uploadedImages
  };
  
  try {
    const id = document.getElementById('productId').value;
    const url = id ? `/api/products/${id}` : '/api/products';
    const method = id ? 'PUT' : 'POST';
    
    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(productData)
    });
    
    if (res.ok) {
      showToast('Lưu sản phẩm thành công!', 'success');
      closeProductModal();
      loadProducts();
    } else {
      showToast('Lỗi lưu sản phẩm', 'error');
    }
  } catch (error) {
    console.error('Error saving product:', error);
    showToast('Lỗi lưu sản phẩm', 'error');
  }
}

async function deleteProduct(id) {
  if (!confirm('Bạn có chắc muốn xóa sản phẩm này?')) return;
  
  try {
    const res = await fetch(`/api/products/${id}`, { method: 'DELETE' });
    if (res.ok) {
      showToast('Xóa sản phẩm thành công!', 'success');
      loadProducts();
    }
  } catch (error) {
    console.error('Error deleting product:', error);
    showToast('Lỗi xóa sản phẩm', 'error');
  }
}

async function handleImageUpload(e) {
  const files = Array.from(e.target.files);
  
  for (const file of files) {
    try {
      const formData = new FormData();
      formData.append('image', file);
      
      const res = await fetch('/api/upload', {
        method: 'POST',
        body: formData
      });
      
      const data = await res.json();
      uploadedImages.push(data.url);
      
    } catch (error) {
      console.error('Upload error:', error);
      showToast('Lỗi upload ảnh', 'error');
    }
  }
  
  renderImagePreviews();
  e.target.value = '';
}

function renderImagePreviews() {
  const container = document.getElementById('imagePreview');
  container.innerHTML = uploadedImages.map((img, index) => `
    <div class="image-preview-item">
      <img src="${img}" alt="Preview">
      <button type="button" class="image-preview-remove" onclick="removeImage(${index})">×</button>
    </div>
  `).join('');
}

function removeImage(index) {
  uploadedImages.splice(index, 1);
  renderImagePreviews();
}

async function checkSEO() {
  const data = {
    title: document.getElementById('productName').value,
    description: document.getElementById('productDescription').value,
    keywords: document.getElementById('productTags').value,
    content: document.getElementById('productDescription').value,
    images: uploadedImages.map(url => ({ url, alt: document.getElementById('productName').value }))
  };
  
  try {
    const res = await fetch('/api/seo-check', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    
    const result = await res.json();
    displaySEOScore(result);
  } catch (error) {
    console.error('SEO check error:', error);
    showToast('Lỗi kiểm tra SEO', 'error');
  }
}

function displaySEOScore(result) {
  document.getElementById('seoScoreBox').style.display = 'block';
  document.getElementById('seoScoreValue').textContent = result.total;
  document.getElementById('seoGrade').textContent = result.grade;
  
  const checksHTML = result.checks.map(check => `
    <div class="seo-check-item ${check.status}">
      <span>${check.name}</span>
      <span>${check.points} điểm</span>
    </div>
    ${check.message ? `<div style="font-size: 0.875rem; opacity: 0.9; padding-left: 1rem;">${check.message}</div>` : ''}
  `).join('');
  
  document.getElementById('seoChecks').innerHTML = checksHTML;
  
  document.getElementById('seoScoreBox').scrollIntoView({ behavior: 'smooth' });
}

// ==================== CATEGORIES MANAGEMENT ====================
async function loadCategories() {
  try {
    const res = await fetch('/api/categories');
    categories = await res.json();
    renderCategoriesGrid();
  } catch (error) {
    console.error('Error loading categories:', error);
    showToast('Lỗi tải danh mục', 'error');
  }
}

function renderCategoriesGrid() {
  const grid = document.getElementById('categoriesGrid');
  grid.innerHTML = categories.map(cat => `
    <div class="category-card">
      <h3>${cat.name}</h3>
      <p>${cat.description || 'Không có mô tả'}</p>
      <div class="category-actions">
        <button class="btn btn-sm btn-primary" onclick="editCategory('${cat.id}')">✏️ Sửa</button>
        <button class="btn btn-sm btn-danger" onclick="deleteCategory('${cat.id}')">🗑️ Xóa</button>
      </div>
    </div>
  `).join('');
}

function loadCategoryOptions() {
  const select = document.getElementById('productCategory');
  select.innerHTML = categories.map(cat => 
    `<option value="${cat.id}">${cat.name}</option>`
  ).join('');
}

function openCategoryModal() {
  document.getElementById('categoryForm').reset();
  document.getElementById('categoryId').value = '';
  document.getElementById('categoryModal').classList.add('active');
}

function editCategory(id) {
  const category = categories.find(c => c.id === id);
  if (!category) return;
  
  document.getElementById('categoryId').value = category.id;
  document.getElementById('categoryName').value = category.name;
  document.getElementById('categoryDescription').value = category.description || '';
  document.getElementById('categoryModal').classList.add('active');
}

function closeCategoryModal() {
  document.getElementById('categoryModal').classList.remove('active');
}

async function saveCategory(e) {
  e.preventDefault();
  
  const data = {
    name: document.getElementById('categoryName').value,
    description: document.getElementById('categoryDescription').value,
    image: categoryImagePath || ''  // ← THÊM DÒNG NÀY
  };
  
  try {
    const id = document.getElementById('categoryId').value;
    const url = id ? `/api/categories/${id}` : '/api/categories';
    const method = id ? 'PUT' : 'POST';
    
    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    
    if (res.ok) {
      showToast('✅ Lưu danh mục thành công!', 'success');
      closeCategoryModal();
      loadCategories();
      categoryImagePath = '';  // ← THÊM DÒNG NÀY - Reset sau khi lưu
    } else {
      showToast('❌ Lỗi lưu danh mục', 'error');
    }
  } catch (error) {
    console.error('Error saving category:', error);
    showToast('❌ Lỗi server', 'error');
  }
}

async function deleteCategory(id) {
  if (!confirm('Bạn có chắc muốn xóa danh mục này?')) return;
  
  try {
    const res = await fetch(`/api/categories/${id}`, { method: 'DELETE' });
    if (res.ok) {
      showToast('Xóa danh mục thành công!', 'success');
      loadCategories();
    }
  } catch (error) {
    console.error('Error deleting category:', error);
    showToast('Lỗi xóa danh mục', 'error');
  }
}

// ==================== POSTS MANAGEMENT ====================
async function loadPosts() {
  try {
    const res = await fetch('/api/posts');
    posts = await res.json();
    renderPostsTable(posts);
  } catch (error) {
    console.error('Error loading posts:', error);
    showToast('Lỗi tải bài viết', 'error');
  }
}

function renderPostsTable(postsToRender) {
  const tbody = document.getElementById('postsTableBody');
  
  if (!tbody) return; // Nếu chưa có posts page thì bỏ qua
  
  if (postsToRender.length === 0) {
    tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; padding: 2rem;">Chưa có bài viết nào</td></tr>';
    return;
  }
  
  tbody.innerHTML = postsToRender.map(p => {
    const seoScore = calculatePostSEO(p);
    const gradeClass = seoScore >= 85 ? 'grade-a' : seoScore >= 70 ? 'grade-b' : seoScore >= 50 ? 'grade-c' : 'grade-d';
    
    return `
      <tr>
        <td>
          <strong>${p.title}</strong>
          <div style="font-size: 0.75rem; color: var(--text-light);">
            ${new Date(p.createdAt).toLocaleDateString('vi-VN')}
          </div>
        </td>
        <td>${p.category || 'N/A'}</td>
        <td>${p.views || 0} 👁️</td>
        <td>
          <span style="display: inline-block; padding: 0.25rem 0.75rem; border-radius: 0.375rem; font-size: 0.75rem; font-weight: 600; background: ${p.published ? '#dcfce7' : '#fef3c7'}; color: ${p.published ? '#166534' : '#92400e'};">
            ${p.published ? '✅ Xuất bản' : '⏳ Nháp'}
          </span>
        </td>
        <td>
          <span class="seo-badge ${gradeClass}">${seoScore}/100</span>
        </td>
        <td>
          <button class="btn btn-sm btn-primary" onclick="editPost('${p.id}')">✏️</button>
          <button class="btn btn-sm btn-danger" onclick="deletePost('${p.id}')">🗑️</button>
        </td>
      </tr>
    `;
  }).join('');
}

function calculatePostSEO(post) {
  let score = 0;
  
  if (post.title && post.title.length >= 40 && post.title.length <= 60) score += 15;
  if (post.metaDescription && post.metaDescription.length >= 120 && post.metaDescription.length <= 160) score += 15;
  if (post.excerpt && post.excerpt.length >= 120) score += 10;
  if (post.content && post.content.length >= 500) score += 20;
  if (post.tags && post.tags.length >= 3) score += 10;
  if (post.featuredImage) score += 10;
  if (post.category) score += 10;
  if (post.content && post.content.includes('<h2>')) score += 10;
  
  return score;
}

function openPostModal() {
  currentPost = null;
  postFeaturedImage = '';
  document.getElementById('postForm').reset();
  document.getElementById('postId').value = '';
  document.getElementById('postModalTitle').textContent = 'Thêm bài viết mới';
  document.getElementById('postImagePreview').innerHTML = '';
  
  const postSeoBox = document.getElementById('postSeoScoreBox');
  if (postSeoBox) postSeoBox.style.display = 'none';
  
  document.getElementById('postPublished').checked = true;
  document.getElementById('postModal').classList.add('active');
}

async function editPost(id) {
  currentPost = posts.find(p => p.id === id);
  if (!currentPost) return;
  
  document.getElementById('postId').value = currentPost.id;
  document.getElementById('postTitle').value = currentPost.title;
  document.getElementById('postCategory').value = currentPost.category || '';
  document.getElementById('postAuthor').value = currentPost.author || 'Admin';
  document.getElementById('postExcerpt').value = currentPost.excerpt;
  document.getElementById('postContent').value = currentPost.content;
  document.getElementById('postTags').value = currentPost.tags?.join(', ') || '';
  document.getElementById('postMetaTitle').value = currentPost.metaTitle || '';
  document.getElementById('postMetaDescription').value = currentPost.metaDescription || '';
  document.getElementById('postMetaKeywords').value = currentPost.metaKeywords || '';
  document.getElementById('postPublished').checked = currentPost.published !== false;
  
  postFeaturedImage = currentPost.featuredImage || '';
  if (postFeaturedImage) {
    document.getElementById('postImagePreview').innerHTML = `
      <div class="image-preview-item">
        <img src="${postFeaturedImage}" alt="Featured">
        <button type="button" class="image-preview-remove" onclick="removePostImage()">×</button>
      </div>
    `;
  }
  
  document.getElementById('postModalTitle').textContent = 'Sửa bài viết';
  document.getElementById('postModal').classList.add('active');
}

function closePostModal() {
  document.getElementById('postModal').classList.remove('active');
  currentPost = null;
  postFeaturedImage = '';
}

async function savePost(e) {
  e.preventDefault();
  
  const postData = {
    title: document.getElementById('postTitle').value,
    category: document.getElementById('postCategory').value,
    author: document.getElementById('postAuthor').value,
    excerpt: document.getElementById('postExcerpt').value,
    content: document.getElementById('postContent').value,
    tags: document.getElementById('postTags').value.split(',').map(t => t.trim()).filter(t => t),
    featuredImage: postFeaturedImage,
    metaTitle: document.getElementById('postMetaTitle').value,
    metaDescription: document.getElementById('postMetaDescription').value,
    metaKeywords: document.getElementById('postMetaKeywords').value,
    published: document.getElementById('postPublished').checked
  };
  
  try {
    const id = document.getElementById('postId').value;
    const url = id ? `/api/posts/${id}` : '/api/posts';
    const method = id ? 'PUT' : 'POST';
    
    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(postData)
    });
    
    if (res.ok) {
      showToast('Lưu bài viết thành công!', 'success');
      closePostModal();
      loadPosts();
    } else {
      showToast('Lỗi lưu bài viết', 'error');
    }
  } catch (error) {
    console.error('Error saving post:', error);
    showToast('Lỗi lưu bài viết', 'error');
  }
}

async function deletePost(id) {
  if (!confirm('Bạn có chắc muốn xóa bài viết này?')) return;
  
  try {
    const res = await fetch(`/api/posts/${id}`, { method: 'DELETE' });
    if (res.ok) {
      showToast('Xóa bài viết thành công!', 'success');
      loadPosts();
    }
  } catch (error) {
    console.error('Error deleting post:', error);
    showToast('Lỗi xóa bài viết', 'error');
  }
}

async function handlePostImageUpload(e) {
  const file = e.target.files[0];
  if (!file) return;
  
  try {
    const formData = new FormData();
    formData.append('image', file);
    
    const res = await fetch('/api/upload', {
      method: 'POST',
      body: formData
    });
    
    const data = await res.json();
    postFeaturedImage = data.url;
    
    document.getElementById('postImagePreview').innerHTML = `
      <div class="image-preview-item">
        <img src="${data.url}" alt="Featured">
        <button type="button" class="image-preview-remove" onclick="removePostImage()">×</button>
      </div>
    `;
    
    e.target.value = '';
  } catch (error) {
    console.error('Upload error:', error);
    showToast('Lỗi upload ảnh', 'error');
  }
}

function removePostImage() {
  postFeaturedImage = '';
  document.getElementById('postImagePreview').innerHTML = '';
}

async function checkPostSEO() {
  const data = {
    title: document.getElementById('postMetaTitle').value || document.getElementById('postTitle').value,
    description: document.getElementById('postMetaDescription').value || document.getElementById('postExcerpt').value,
    keywords: document.getElementById('postMetaKeywords').value || document.getElementById('postTags').value,
    content: document.getElementById('postContent').value,
    images: postFeaturedImage ? [{ url: postFeaturedImage, alt: document.getElementById('postTitle').value }] : []
  };
  
  try {
    const res = await fetch('/api/seo-check', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    
    const result = await res.json();
    displayPostSEOScore(result);
  } catch (error) {
    console.error('SEO check error:', error);
    showToast('Lỗi kiểm tra SEO', 'error');
  }
}

function displayPostSEOScore(result) {
  const scoreBox = document.getElementById('postSeoScoreBox');
  if (!scoreBox) return;
  
  scoreBox.style.display = 'block';
  document.getElementById('postSeoScoreValue').textContent = result.total;
  document.getElementById('postSeoGrade').textContent = result.grade;
  
  const checksHTML = result.checks.map(check => `
    <div class="seo-check-item ${check.status}">
      <span>${check.name}</span>
      <span>${check.points} điểm</span>
    </div>
    ${check.message ? `<div style="font-size: 0.875rem; opacity: 0.9; padding-left: 1rem;">${check.message}</div>` : ''}
  `).join('');
  
  document.getElementById('postSeoChecks').innerHTML = checksHTML;
  
  scoreBox.scrollIntoView({ behavior: 'smooth' });
}

// ==================== SETTINGS MANAGEMENT ====================
async function loadSettings() {
  try {
    const res = await fetch('/api/settings');
    settings = await res.json();
    
    // Basic SEO
    document.getElementById('siteTitle').value = settings.siteTitle || '';
    document.getElementById('siteDescription').value = settings.siteDescription || '';
    document.getElementById('keywords').value = settings.keywords || '';
    document.getElementById('email').value = settings.email || '';
    document.getElementById('phone').value = settings.phone || '';
    document.getElementById('address').value = settings.address || '';
    
    // Hero Banner
    document.getElementById('heroTitle').value = settings.heroTitle || '';
    document.getElementById('heroSubtitle').value = settings.heroSubtitle || '';
    if (settings.heroImage) {
      document.getElementById('heroImagePreview').innerHTML = `<img src="${settings.heroImage}" style="max-width:300px;border-radius:8px">`;
    }
    
    // Floating Buttons
    document.getElementById('showFloatingButtons').checked = settings.showFloatingButtons || false;
    document.getElementById('floatingPhone').value = settings.floatingPhone || '';
    document.getElementById('floatingZalo').value = settings.floatingZalo || '';
    document.getElementById('floatingFacebook').value = settings.floatingFacebook || '';
    
    // Icons Preview
    if (settings.phoneIcon) {
      document.getElementById('phoneIconPreview').innerHTML = `<img src="${settings.phoneIcon}" style="width:64px;height:64px;border-radius:8px">`;
    }
    if (settings.zaloIcon) {
      document.getElementById('zaloIconPreview').innerHTML = `<img src="${settings.zaloIcon}" style="width:64px;height:64px;border-radius:8px">`;
    }
    if (settings.facebookIcon) {
      document.getElementById('facebookIconPreview').innerHTML = `<img src="${settings.facebookIcon}" style="width:64px;height:64px;border-radius:8px">`;
    }
    
    // Footer Contact
    document.getElementById('officeAddress').value = settings.officeAddress || '';
    document.getElementById('workingHours').value = settings.workingHours || '';
    document.getElementById('mapLink').value = settings.mapLink || '';
    document.getElementById('staff1Name').value = settings.staff1Name || '';
    document.getElementById('staff1Title').value = settings.staff1Title || '';
    document.getElementById('staff1Phone').value = settings.staff1Phone || '';
    document.getElementById('staff2Name').value = settings.staff2Name || '';
    document.getElementById('staff2Title').value = settings.staff2Title || '';
    document.getElementById('staff2Phone').value = settings.staff2Phone || '';
    if (settings.companyImage) {
      document.getElementById('companyImagePreview').innerHTML = `<img src="${settings.companyImage}" style="max-width:250px;border-radius:8px">`;
    }
    
  } catch (error) {
    console.error('Error loading settings:', error);
    showToast('Lỗi tải cài đặt', 'error');
  }
}

async function saveSettings(e) {
  e.preventDefault();
  
  const updatedSettings = {
    // Basic SEO
    siteTitle: document.getElementById('siteTitle').value,
    siteDescription: document.getElementById('siteDescription').value,
    keywords: document.getElementById('keywords').value,
    email: document.getElementById('email').value,
    phone: document.getElementById('phone').value,
    address: document.getElementById('address').value,
    
    // Hero Banner
    heroTitle: document.getElementById('heroTitle').value,
    heroSubtitle: document.getElementById('heroSubtitle').value,
    heroImage: settings.heroImage || '',
    
    // Floating Buttons
    showFloatingButtons: document.getElementById('showFloatingButtons').checked,
    floatingPhone: document.getElementById('floatingPhone').value,
    floatingZalo: document.getElementById('floatingZalo').value,
    floatingFacebook: document.getElementById('floatingFacebook').value,
    phoneIcon: settings.phoneIcon || '',
    zaloIcon: settings.zaloIcon || '',
    facebookIcon: settings.facebookIcon || '',
    
    // Footer Contact
    companyImage: settings.companyImage || '',
    officeAddress: document.getElementById('officeAddress').value,
    workingHours: document.getElementById('workingHours').value,
    mapLink: document.getElementById('mapLink').value,
    staff1Name: document.getElementById('staff1Name').value,
    staff1Title: document.getElementById('staff1Title').value,
    staff1Phone: document.getElementById('staff1Phone').value,
    staff2Name: document.getElementById('staff2Name').value,
    staff2Title: document.getElementById('staff2Title').value,
    staff2Phone: document.getElementById('staff2Phone').value,
    
    // Keep old fields
    author: settings.author || 'Nội Thất Cao Cấp',
    logo: settings.logo || '/images/logo.png'
  };
  
  try {
    const res = await fetch('/api/settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updatedSettings)
    });
    
    if (res.ok) {
      settings = updatedSettings;
      showToast('✅ Lưu cài đặt thành công!', 'success');
    } else {
      showToast('❌ Lỗi khi lưu cài đặt', 'error');
    }
  } catch (error) {
    console.error('Error saving settings:', error);
    showToast('❌ Lỗi server', 'error');
  }
}

// ==================== TOAST NOTIFICATION ====================
function showToast(message, type = 'info') {
  const toast = document.getElementById('toast');
  toast.textContent = message;
  toast.className = `toast ${type} show`;
  
  setTimeout(() => {
    toast.classList.remove('show');
  }, 3000);
}

// ===== UPLOAD HANDLERS - ADDED =====
document.getElementById('heroImage')?.addEventListener('change', async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  const formData = new FormData();
  formData.append('heroImage', file);
  try {
    const res = await fetch('/api/upload/hero', { method: 'POST', body: formData });
    const data = await res.json();
    if (data.path) {
      settings.heroImage = data.path;
      document.getElementById('heroImagePreview').innerHTML = `<img src="${data.path}" style="max-width:300px;border-radius:8px">`;
      showToast('Upload thành công', 'success');
    }
  } catch (err) { showToast('Lỗi upload', 'error'); }
});

document.getElementById('phoneIcon')?.addEventListener('change', async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  const formData = new FormData();
  formData.append('icon', file);
  try {
    const res = await fetch('/api/upload/icon/phone', { method: 'POST', body: formData });
    const data = await res.json();
    if (data.path) {
      settings.phoneIcon = data.path;
      document.getElementById('phoneIconPreview').innerHTML = `<img src="${data.path}" style="width:64px;height:64px;border-radius:8px">`;
      showToast('Upload icon phone OK', 'success');
    }
  } catch (err) { showToast('Lỗi upload', 'error'); }
});

document.getElementById('zaloIcon')?.addEventListener('change', async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  const formData = new FormData();
  formData.append('icon', file);
  try {
    const res = await fetch('/api/upload/icon/zalo', { method: 'POST', body: formData });
    const data = await res.json();
    if (data.path) {
      settings.zaloIcon = data.path;
      document.getElementById('zaloIconPreview').innerHTML = `<img src="${data.path}" style="width:64px;height:64px;border-radius:8px">`;
      showToast('Upload icon Zalo OK', 'success');
    }
  } catch (err) { showToast('Lỗi upload', 'error'); }
});

document.getElementById('facebookIcon')?.addEventListener('change', async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  const formData = new FormData();
  formData.append('icon', file);
  try {
    const res = await fetch('/api/upload/icon/facebook', { method: 'POST', body: formData });
    const data = await res.json();
    if (data.path) {
      settings.facebookIcon = data.path;
      document.getElementById('facebookIconPreview').innerHTML = `<img src="${data.path}" style="width:64px;height:64px;border-radius:8px">`;
      showToast('Upload icon Facebook OK', 'success');
    }
  } catch (err) { showToast('Lỗi upload', 'error'); }
});

let categoryImagePath = '';
document.getElementById('categoryImage')?.addEventListener('change', async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  const categoryName = document.getElementById('categoryName').value || 'category';
  const formData = new FormData();
  formData.append('categoryImage', file);
  formData.append('categoryName', categoryName);
  try {
    const res = await fetch('/api/upload/category', { method: 'POST', body: formData });
    const data = await res.json();
    if (data.path) {
      categoryImagePath = data.path;
      document.getElementById('categoryImagePreview').innerHTML = `<img src="${data.path}" style="max-width:200px;border-radius:8px">`;
      showToast('Upload ảnh danh mục OK', 'success');
    }
  } catch (err) { showToast('Lỗi upload', 'error'); }
});

document.getElementById('companyImage')?.addEventListener('change', async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  const formData = new FormData();
  formData.append('companyImage', file);
  try {
    const res = await fetch('/api/upload/company', { method: 'POST', body: formData });
    const data = await res.json();
    if (data.path) {
      settings.companyImage = data.path;
      document.getElementById('companyImagePreview').innerHTML = `<img src="${data.path}" style="max-width:250px;border-radius:8px">`;
      showToast('Upload ảnh công ty OK', 'success');
    }
  } catch (err) { showToast('Lỗi upload', 'error'); }
});

