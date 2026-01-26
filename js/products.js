// ===================================
// Global State
// ===================================
let allProducts = [];
let currentProduct = null;

// ===================================
// Theme Management
// ===================================
function initTheme() {
    const theme = localStorage.getItem('theme') || 'light';
    document.documentElement.setAttribute('data-theme', theme);
    
    const themeToggle = document.getElementById('themeToggle');
    if (themeToggle) {
        themeToggle.addEventListener('click', toggleTheme);
    }
}

function toggleTheme() {
    const currentTheme = document.documentElement.getAttribute('data-theme');
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
    
    document.documentElement.setAttribute('data-theme', newTheme);
    localStorage.setItem('theme', newTheme);
}

// ===================================
// Header Scroll Effect
// ===================================
function initHeader() {
    const header = document.getElementById('header');
    
    window.addEventListener('scroll', () => {
        if (window.scrollY > 50) {
            header.classList.add('scrolled');
        } else {
            header.classList.remove('scrolled');
        }
    });
}

// ===================================
// Get Product Slug from Clean URL
// ===================================
function getProductSlugFromUrl() {
    const pathname = window.location.pathname;
    
    // Extract slug from: /product/artisan-leather-messenger-bag
    // Matches both /product/slug and /products/slug
    const match = pathname.match(/\/(?:product|products)\/([a-z0-9-]+)\/?$/);
    
    if (match && match[1]) {
        return match[1];
    }
    
    // Check if old ID-based URL somehow exists (should be blocked by _redirects)
    const urlParams = new URLSearchParams(window.location.search);
    const oldId = urlParams.get('id');
    
    if (oldId) {
        // Old ID-based URL detected - redirect to 404
        // This shouldn't happen if _redirects is working, but safety check
        console.warn('ID-based URL detected - redirecting to 404');
        window.location.replace('/404.html');
        return null;
    }
    
    // No slug found - will show 404
    return null;
}

// ===================================
// Get Product ID from URL
// ===================================
//function getProductIdFromUrl() {
//    const urlParams = new URLSearchParams(window.location.search);
//    return urlParams.get('id');
//}

// ===================================
// Load products
// ===================================
async function loadProducts() {
    try {
        const response = await ProductAPI.getProducts(); 
        allProducts = response.data.products;
        
        // Get slug from clean URL
        const productSlug = getProductSlugFromUrl();
        
        if (productSlug) {
            // Find product by slug (NOT id)
            currentProduct = allProducts.find(p => p.slug === productSlug);
            
            if (currentProduct) {
                displayProduct(currentProduct);
                displayRelatedProducts(currentProduct);
                
                // Update canonical URL for SEO
                updateCanonicalUrl(productSlug);
            } else {
                // Slug not found - show 404
                showProductNotFound();
            }
        } else {
            // No slug in URL - show 404
            showProductNotFound();
        }
    } catch (error) {
        console.error('Error loading products:', error);
        showErrorMessage();
    }
}

// Update canonical URL for SEO
function updateCanonicalUrl(slug) {
    let canonical = document.querySelector('link[rel="canonical"]');
    if (!canonical) {
        canonical = document.createElement('link');
        canonical.setAttribute('rel', 'canonical');
        document.head.appendChild(canonical);
    }
    
    const baseUrl = window.location.origin;
    canonical.setAttribute('href', `${baseUrl}/product/${slug}`);
    
    // Also update Open Graph URL for social sharing
    let ogUrl = document.querySelector('meta[property="og:url"]');
    if (!ogUrl) {
        ogUrl = document.createElement('meta');
        ogUrl.setAttribute('property', 'og:url');
        document.head.appendChild(ogUrl);
    }
    ogUrl.setAttribute('content', `${baseUrl}/product/${slug}`);
}

// ===================================
// Display Product Details
// ===================================
function displayProduct(product) {
    // Hide skeleton and show content
    document.getElementById('productSkeleton').style.display = 'none';
    document.getElementById('productDetail').style.display = 'grid';
    
    // Update page title
    document.title = `${product.name} - ELEV8`;
    
    // Update meta description
    const metaDescription = document.querySelector('meta[name="description"]');
    if (metaDescription) {
        metaDescription.content = product.description;
    }
    
    // Set product image
    const productImage = document.getElementById('productImage');
    productImage.src = product.image;
    productImage.alt = product.name;
    
    // Set product badge if exists
    const productBadge = document.getElementById('productBadge');
    if (product.badge) {
        const badgeClass = product.badge.toLowerCase() === 'trending' ? 'trending' : '';
        productBadge.className = `product-badge ${badgeClass}`;
        productBadge.textContent = product.badge;
        productBadge.style.display = 'block';
    } else {
        productBadge.style.display = 'none';
    }
    
    // Set breadcrumb and category
    document.getElementById('productCategory').textContent = product.category;
    document.getElementById('productCategoryMeta').textContent = product.category;
    
    // Set title and description
    document.getElementById('productTitle').textContent = product.name;
    document.getElementById('productDescription').textContent = product.description;
    
    // Set price
    document.getElementById('productPrice').textContent = `₹${product.price.toFixed(2)}`;
    
    // Set add to cart button action
    const addToCartBtn = document.getElementById('addToCartBtn');
    addToCartBtn.addEventListener('click', async () => {
        const button = addToCartBtn;
        const originalHTML = button.innerHTML;
        
        button.disabled = true;
        button.innerHTML = '<span class="spinner"></span> Adding...';
        
        try {
            if (Auth.isLoggedIn()) {
                const response = await CartAPI.addItem(product.id, 1);
                
                if (response.success) {
                    Toast.success('Added to cart!');
                    await Cart.updateCartBadge();
                } else {
                    Toast.error(response.message || 'Failed to add to cart');
                }
            } else {
                Cart.addToLocalCart(product, 1);
                Toast.success('Added to cart!');
            }
        } catch (error) {
            console.error('Add to cart error:', error);
            Toast.error('Failed to add to cart');
        } finally {
            button.disabled = false;
            button.innerHTML = originalHTML;
        }
    });
    
    // Set buy button action - Add to cart and go to checkout
    const buyButton = document.getElementById('buyNowBtn');
    buyButton.addEventListener('click', async () => {
        // Disable button and show loading
        buyButton.disabled = true;
        const originalHTML = buyButton.innerHTML;
        buyButton.innerHTML = `
            <div class="spinner"></div>
            <span>Processing...</span>
        `;

        try {
            // Add to cart (logged in or not)
            if (Auth.isLoggedIn()) {
                const response = await CartAPI.addItem(product.id, 1);
                
                if (response.success) {
                    // Redirect to checkout
                    window.location.href = 'cart.html';
                } else {
                    Toast.error(response.message || 'Failed to add item');
                    buyButton.disabled = false;
                    buyButton.innerHTML = originalHTML;
                }
            } else {
                // Add to local cart and redirect
                Cart.addToLocalCart(product, 1);
                window.location.href = 'cart.html';
            }
        } catch (error) {
            console.error('Buy now error:', error);
            Toast.error('Failed to process. Please try again.');
            buyButton.disabled = false;
            buyButton.innerHTML = originalHTML;
        }
    });
    
    // Animate elements
    animateProductElements();
}

// ===================================
// Animate Product Elements
// ===================================
function animateProductElements() {
    const elements = document.querySelectorAll('.product-gallery, .product-info > *');
    elements.forEach((el, index) => {
        el.style.opacity = '0';
        el.style.transform = 'translateY(20px)';
        
        setTimeout(() => {
            el.style.transition = 'opacity 0.6s ease, transform 0.6s ease';
            el.style.opacity = '1';
            el.style.transform = 'translateY(0)';
        }, index * 100);
    });
}

// ===================================
// Display Related Products
// ===================================
function displayRelatedProducts(currentProduct) {
    const relatedSection = document.getElementById('relatedProducts');
    const relatedGrid = document.getElementById('relatedGrid');
    
    // Find products in the same category, excluding current product
    const related = allProducts
        .filter(p => p.category === currentProduct.category && p.id !== currentProduct.id)
        .slice(0, 4);
    
    if (related.length === 0) {
        relatedSection.style.display = 'none';
        return;
    }
    
    relatedGrid.innerHTML = '';
    
    related.forEach((product, index) => {
        const card = createProductCard(product, index);
        relatedGrid.appendChild(card);
    });
}

// ===================================
// Create Product Card for Related Products
// ===================================
function createProductCard(product, index) {
    const card = document.createElement('div');
    card.className = 'product-card';
    card.style.animationDelay = `${index * 0.1}s`;
    
    // Determine badge
    let badge = '';
    if (product.badge) {
        const badgeClass = product.badge.toLowerCase() === 'trending' ? 'trending' : '';
        badge = `<div class="product-badge ${badgeClass}">${product.badge}</div>`;
    }
    
    card.innerHTML = `
        <div class="product-image-container">
            <img 
                src="${product.image}" 
                alt="${product.name}" 
                class="product-image"
                loading="lazy"
            >
            ${badge}
        </div>
        <div class="product-content">
            <div class="product-category">${product.category}</div>
            <h3 class="product-name">${product.name}</h3>
            <p class="product-description">${product.description}</p>
            <div class="product-footer">
                <div class="product-price">₹${product.price.toFixed(2)}</div>
                <button class="btn-buy" onclick="handleBuyClick(event, '${product.slug}')" aria-label="Buy ${product.name}">
                    Buy Now
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <line x1="5" y1="12" x2="19" y2="12"/>
                        <polyline points="12 5 19 12 12 19"/>
                    </svg>
                </button>
            </div>
        </div>
    `;
    
    // Navigate to product detail on card click (except buy button)
    card.addEventListener('click', (e) => {
        if (!e.target.closest('.btn-buy')) {
            //window.location.href = `product.html?id=${product.id}`;
            window.location.href = `/product/${product.slug}`;
        }
    });
    
    return card;
}

// ===================================
// Handle Buy Button Click
// ===================================
function handleBuyClick(event, productSlug) {
    event.stopPropagation();
    // Redirect to product detail page where user can use the Buy Now button
    //window.location.href = `product.html?id=${productId}`;
    // Use clean URL format
    window.location.href = `/product/${productSlug}`;
}

// ===================================
// Show Product Not Found
// ===================================
function showProductNotFound() {
    document.getElementById('productSkeleton').style.display = 'none';
    
    const container = document.querySelector('.product-detail-section .container');
    container.innerHTML = `
        <div style="text-align: center; padding: 4rem 1rem; min-height: 60vh; display: flex; flex-direction: column; justify-content: center; align-items: center;">
            <svg width="80" height="80" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="margin-bottom: 2rem; color: var(--color-text-secondary);">
                <circle cx="12" cy="12" r="10"/>
                <line x1="12" y1="8" x2="12" y2="12"/>
                <line x1="12" y1="16" x2="12.01" y2="16"/>
            </svg>
            <h1 style="font-family: var(--font-display); font-size: 2.5rem; margin-bottom: 1rem; color: var(--color-text);">
                Product Not Found
            </h1>
            <p style="color: var(--color-text-secondary); margin-bottom: 2rem; font-size: 1.1rem;">
                Sorry, the product you're looking for doesn't exist or has been removed.
            </p>
            <a href="index.html" style="display: inline-flex; align-items: center; gap: 0.5rem; padding: 1rem 2rem; background: var(--color-primary); color: var(--color-bg); border-radius: 999px; font-weight: 600; transition: all 0.3s ease;">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <line x1="19" y1="12" x2="5" y2="12"/>
                    <polyline points="12 19 5 12 12 5"/>
                </svg>
                Back to Shop
            </a>
        </div>
    `;
}

// ===================================
// Show Error Message
// ===================================
function showErrorMessage() {
    document.getElementById('productSkeleton').style.display = 'none';
    
    const container = document.querySelector('.product-detail-section .container');
    container.innerHTML = `
        <div style="text-align: center; padding: 4rem 1rem; min-height: 60vh; display: flex; flex-direction: column; justify-content: center; align-items: center;">
            <svg width="80" height="80" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="margin-bottom: 2rem; color: var(--color-text-secondary);">
                <circle cx="12" cy="12" r="10"/>
                <line x1="15" y1="9" x2="9" y2="15"/>
                <line x1="9" y1="9" x2="15" y2="15"/>
            </svg>
            <h1 style="font-family: var(--font-display); font-size: 2.5rem; margin-bottom: 1rem; color: var(--color-text);">
                Unable to Load Product
            </h1>
            <p style="color: var(--color-text-secondary); margin-bottom: 2rem; font-size: 1.1rem;">
                Please check your connection and try again.
            </p>
            <a href="index.html" style="display: inline-flex; align-items: center; gap: 0.5rem; padding: 1rem 2rem; background: var(--color-primary); color: var(--color-bg); border-radius: 999px; font-weight: 600; transition: all 0.3s ease;">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <line x1="19" y1="12" x2="5" y2="12"/>
                    <polyline points="12 19 5 12 12 5"/>
                </svg>
                Back to Shop
            </a>
        </div>
    `;
}

// ===================================
// Initialize Product Page
// ===================================
function init() {
    initTheme();
    initHeader();
    loadProducts();
}

// Start the app when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}
