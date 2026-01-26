// ===================================
// Global State Management
// ===================================

let allProducts = [];
let filteredProducts = [];
let displayedProducts = [];
const PRODUCTS_PER_PAGE = 8;
let currentPage = 1;

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
// User Menu
// ===================================
function initUserMenu() {
    const userMenuBtn = document.getElementById('userMenuBtn');
    const userDropdown = document.getElementById('userDropdown');
    
    if (!userMenuBtn || !userDropdown) return;
    
    if (Auth.isLoggedIn()) {
        const user = Auth.getUser();
        userDropdown.innerHTML = `
            <div class="user-info">
                <strong>${user.firstName} ${user.lastName}</strong>
                <span>${user.email}</span>
            </div>
            <a href="orders.html" class="dropdown-item">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <rect x="3" y="3" width="18" height="18" rx="2"/>
                    <path d="M3 9h18"/>
                </svg>
                My Orders
            </a>
            <button class="dropdown-item" id="logoutBtn">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
                    <polyline points="16 17 21 12 16 7"/>
                    <line x1="21" y1="12" x2="9" y2="12"/>
                </svg>
                Logout
            </button>
        `;
        
        document.getElementById('logoutBtn').addEventListener('click', async () => {
            await AuthAPI.logout();
        });
    } else {
        userDropdown.innerHTML = `
            <a href="login.html" class="dropdown-item">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/>
                    <polyline points="10 17 15 12 10 7"/>
                    <line x1="15" y1="12" x2="3" y2="12"/>
                </svg>
                Login
            </a>
            <a href="register.html" class="dropdown-item">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
                    <circle cx="8.5" cy="7" r="4"/>
                    <line x1="20" y1="8" x2="20" y2="14"/>
                    <line x1="23" y1="11" x2="17" y2="11"/>
                </svg>
                Register
            </a>
        `;
    }
    
    // Toggle dropdown
    userMenuBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        userDropdown.classList.toggle('show');
    });
    
    // Close dropdown when clicking outside
    document.addEventListener('click', () => {
        userDropdown.classList.remove('show');
    });
}

// ===================================
// Load Products from JSON
// ===================================
async function loadProducts() {
    try {
        const response = await ProductAPI.getProducts(); //await fetch('data/products.json');
        //const data = await response.json();
        allProducts = response.data.products;
        filteredProducts = [...allProducts];
        
        populateCategoryFilter();
        displayProducts();
        updateResultsCount();
    } catch (error) {
        console.error('Error loading products:', error);
        showErrorMessage();
    }
}

// ===================================
// Populate Category Filter
// ===================================
function populateCategoryFilter() {
    const categoryFilter = document.getElementById('categoryFilter');
    if (!categoryFilter) return;

    const categories = [...new Set(allProducts.map(p => p.category))];
    
    categories.forEach(category => {
        const option = document.createElement('option');
        option.value = category.toLowerCase();
        option.textContent = category;
        categoryFilter.appendChild(option);
    });
}

// ===================================
// Display Products with Pagination
// ===================================
function displayProducts() {
    const grid = document.getElementById('productsGrid');
    if (!grid) return;

    const startIndex = 0;
    const endIndex = currentPage * PRODUCTS_PER_PAGE;
    
    displayedProducts = filteredProducts.slice(startIndex, endIndex);
    
    grid.innerHTML = '';
    
    displayedProducts.forEach((product, index) => {
        const card = createProductCard(product, index);
        grid.appendChild(card);
    });
    
    // Show/hide load more button
    const loadMoreBtn = document.getElementById('loadMoreBtn');
    if (!loadMoreBtn) return;

    if (endIndex >= filteredProducts.length) {
        loadMoreBtn.classList.add('hidden');
    } else {
        loadMoreBtn.classList.remove('hidden');
    }
}

// ===================================
// Create Product Card
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
                <div class="product-actions">
                    <button class="btn-add-cart" aria-label="Add ${product.name} to cart">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <circle cx="9" cy="21" r="1"/>
                            <circle cx="20" cy="21" r="1"/>
                            <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/>
                        </svg>
                    </button>
                </div>
            </div>
        </div>
    `;
    
    // Navigate to product detail on card click (except add to cart button)
    card.addEventListener('click', (e) => {
        if (!e.target.closest('.btn-add-cart')) {
            //window.location.href = `product.html?id=${product.id}`;
            // Use clean URL format: /product/slug
            window.location.href = `/product/${product.slug}`;
        }
    });
    
    // Add to cart button handler
    const addToCartBtn = card.querySelector('.btn-add-cart');
    addToCartBtn.addEventListener('click', (e) => handleAddToCart(e, product));
    
    return card;
}

// ===================================
// Handle Add to Cart
// ===================================

async function handleAddToCart(event, product) {
    event.stopPropagation();
    
    const button = event.currentTarget;
    const originalHTML = button.innerHTML;
    
    // Show loading state
    button.disabled = true;
    button.innerHTML = '<span class="spinner"></span>';
    
    try {
        if (Auth.isLoggedIn()) {
            // Add to server cart
            const response = await CartAPI.addItem(product.id, 1);
            
            if (response.success) {
                Toast.success('Added to cart!');
                await Cart.updateCartBadge();
            } else {
                Toast.error(response.message || 'Failed to add to cart');
            }
        } else {
            // Add to local cart
            Cart.addToLocalCart(product, 1);
            Toast.success('Added to cart!');
        }
    } catch (error) {
        console.error('Add to cart error:', error);
        Toast.error('Failed to add to cart');
    } finally {
        // Restore button
        button.disabled = false;
        button.innerHTML = originalHTML;
    }
}

// ===================================
// Search Functionality
// ===================================
function initSearch() {
    const searchInput = document.getElementById('searchInput');
    if (!searchInput) return;

    let searchTimeout;
    
    searchInput.addEventListener('input', (e) => {
        clearTimeout(searchTimeout);
        searchTimeout = setTimeout(() => {
            filterProducts();
        }, 300);
    });
}

// ===================================
// Filter Functionality
// ===================================
function initFilters() {
    const categoryFilter = document.getElementById('categoryFilter');
    const sortFilter = document.getElementById('sortFilter');

    if (!categoryFilter || !sortFilter) return; // Early return if elements not found
    
    categoryFilter.addEventListener('change', filterProducts);
    sortFilter.addEventListener('change', filterProducts);
}

// ===================================
// Apply All Filters
// ===================================
function filterProducts() {
    const searchQuery = document.getElementById('searchInput').value.toLowerCase();
    const categoryValue = document.getElementById('categoryFilter').value;
    const sortValue = document.getElementById('sortFilter').value;
    
    // Filter by search and category
    filteredProducts = allProducts.filter(product => {
        const matchesSearch = product.name.toLowerCase().includes(searchQuery) ||
                            product.description.toLowerCase().includes(searchQuery) ||
                            product.category.toLowerCase().includes(searchQuery);
        
        const matchesCategory = categoryValue === 'all' || 
                               product.category.toLowerCase() === categoryValue;
        
        return matchesSearch && matchesCategory;
    });
    
    // Sort products
    switch (sortValue) {
        case 'price-low':
            filteredProducts.sort((a, b) => a.price - b.price);
            break;
        case 'price-high':
            filteredProducts.sort((a, b) => b.price - a.price);
            break;
        case 'name':
            filteredProducts.sort((a, b) => a.name.localeCompare(b.name));
            break;
        default:
            // Keep original order
            break;
    }
    
    // Reset pagination
    currentPage = 1;
    displayProducts();
    updateResultsCount();
}

// ===================================
// Update Results Count
// ===================================
function updateResultsCount() {
    const resultsCount = document.getElementById('resultsCount');
    if (!resultsCount) return;

    const total = filteredProducts.length;
    const showing = Math.min(displayedProducts.length, total);
    
    resultsCount.textContent = `Showing ${showing} of ${total} products`;
}

// ===================================
// Load More Functionality
// ===================================
function initLoadMore() {
    const loadMoreBtn = document.getElementById('loadMoreBtn');

    if (!loadMoreBtn) return; 
    
    loadMoreBtn.addEventListener('click', () => {
        currentPage++;
        displayProducts();
        updateResultsCount();
        
        // Smooth scroll to new products
        setTimeout(() => {
            const newProductCard = document.querySelector(`.product-card:nth-child(${(currentPage - 1) * PRODUCTS_PER_PAGE + 1})`);
            if (newProductCard) {
                newProductCard.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            }
        }, 100);
    });
}

// ===================================
// Show Error Message
// ===================================
function showErrorMessage() {
    const grid = document.getElementById('productsGrid');
    if (!grid) return;
    
    grid.innerHTML = `
        <div style="grid-column: 1 / -1; text-align: center; padding: 3rem;">
            <h3 style="font-family: var(--font-display); font-size: 1.5rem; margin-bottom: 1rem; color: var(--color-text);">
                Unable to Load Products
            </h3>
            <p style="color: var(--color-text-secondary);">
                Please check your connection and try again.
            </p>
        </div>
    `;
}

// ===================================
// Smooth Scroll for Anchor Links
// ===================================
function initSmoothScroll() {
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function (e) {
            const href = this.getAttribute('href');
            if (href !== '#' && href !== '') {
                e.preventDefault();
                const target = document.querySelector(href);
                if (target) {
                    const headerOffset = 100;
                    const elementPosition = target.getBoundingClientRect().top;
                    const offsetPosition = elementPosition + window.pageYOffset - headerOffset;
                    
                    window.scrollTo({
                        top: offsetPosition,
                        behavior: 'smooth'
                    });
                }
            }
        });
    });
}

// ===================================
// Lazy Loading Images
// ===================================
function initLazyLoading() {
    if ('IntersectionObserver' in window) {
        const imageObserver = new IntersectionObserver((entries, observer) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    const img = entry.target;
                    img.src = img.dataset.src || img.src;
                    img.classList.add('loaded');
                    observer.unobserve(img);
                }
            });
        });
        
        // Observe images as they're added
        const observeImages = () => {
            document.querySelectorAll('img[loading="lazy"]').forEach(img => {
                imageObserver.observe(img);
            });
        };
        
        // Initial observation
        observeImages();
        
        // Re-observe when new products are added
        const gridObserver = new MutationObserver(observeImages);
        const grid = document.getElementById('productsGrid');
        if (grid) {
            gridObserver.observe(grid, { childList: true });
        }
    }
}

// ===================================
// Initialize App
// ===================================
function init() {
    initTheme();
    initHeader();
    initUserMenu();
    initSearch();
    initFilters();
    initLoadMore();
    initSmoothScroll();
    initLazyLoading();
    loadProducts();

    // Update cart badge on page load
    if (typeof Cart !== 'undefined' && Cart.updateCartBadge) {
        Cart.updateCartBadge();
    }
}

// Start the app when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}
