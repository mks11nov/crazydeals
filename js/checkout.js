// ===================================
// Checkout Page JavaScript
// ===================================

let cartData = null;

// ===================================
// Initialize
// ===================================
function init() {
    // Theme
    const theme = localStorage.getItem('theme') || 'light';
    document.documentElement.setAttribute('data-theme', theme);
    document.getElementById('themeToggle')?.addEventListener('click', () => {
        const newTheme = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
        document.documentElement.setAttribute('data-theme', newTheme);
        localStorage.setItem('theme', newTheme);
    });

    // Check authentication
    if (!Auth.isLoggedIn()) {
        localStorage.setItem('returnUrl', 'checkout.html');
        window.location.href = 'login.html';
        return;
    }

    // Header scroll
    window.addEventListener('scroll', () => {
        document.getElementById('header')?.classList.toggle('scrolled', window.scrollY > 50);
    });

    loadCheckoutData();
    initPlaceOrder();
}

// ===================================
// Load Checkout Data
// ===================================
async function loadCheckoutData() {
    try {
        if (Auth.isLoggedIn()) {
            const response = await CartAPI.getCart();
            cartData = response.success ? response.data : getLocalCartData();
        } else {
            cartData = getLocalCartData();
        }

        if (!cartData || cartData.items.length === 0) {
            window.location.href = 'cart.html';
            return;
        }

        displayOrderSummary();
        prefillUserData();
    } catch (error) {
        console.error('Error loading checkout data:', error);
        cartData = getLocalCartData();
        displayOrderSummary();
    }
}

function getLocalCartData() {
    const localCart = Cart.getLocalCart();
    const totals = Cart.calculateTotal();
    return {
        items: localCart.items,
        subtotal: parseFloat(totals.subtotal),
        tax: parseFloat(totals.tax),
        shipping: parseFloat(totals.shipping),
        total: parseFloat(totals.total)
    };
}

// ===================================
// Display Order Summary
// ===================================
function displayOrderSummary() {
    const orderItems = document.getElementById('orderItems');
    orderItems.innerHTML = cartData.items.map(item => `
        <div style="display: flex; gap: 1rem; padding: 0.75rem 0; border-bottom: 1px solid var(--color-border);">
            <img src="${item.image}" alt="${item.name}" style="width: 60px; height: 60px; border-radius: 8px; object-fit: cover;">
            <div style="flex: 1;">
                <div style="font-weight: 600; font-size: 0.95rem; margin-bottom: 0.25rem;">${item.name}</div>
                <div style="color: var(--color-text-secondary); font-size: 0.85rem;">Qty: ${item.quantity}</div>
            </div>
            <div style="font-weight: 700; font-family: var(--font-display);">₹${(item.price * item.quantity).toFixed(2)}</div>
        </div>
    `).join('');

    document.getElementById('checkoutSubtotal').textContent = `₹${cartData.subtotal.toFixed(2)}`;
    document.getElementById('checkoutTax').textContent = `₹${cartData.tax.toFixed(2)}`;
    document.getElementById('checkoutShipping').textContent = cartData.shipping === 0 ? 'FREE' : `₹${cartData.shipping.toFixed(2)}`;
    document.getElementById('checkoutTotal').textContent = `₹${cartData.total.toFixed(2)}`;
}

// ===================================
// Prefill User Data
// ===================================
function prefillUserData() {
    const user = Auth.getUser();
    if (user) {
        document.getElementById('firstName').value = user.firstName || '';
        document.getElementById('lastName').value = user.lastName || '';
        document.getElementById('phone').value = user.phone || '';
    }
}

// ===================================
// Place Order
// ===================================
function initPlaceOrder() {
    document.getElementById('placeOrderBtn').addEventListener('click', async () => {
        const form = document.getElementById('checkoutForm');
        if (!form.checkValidity()) {
            form.reportValidity();
            return;
        }

        const orderData = {
            shippingAddress: {
                firstName: document.getElementById('firstName').value.trim(),
                lastName: document.getElementById('lastName').value.trim(),
                phone: document.getElementById('phone').value.trim(),
                street: document.getElementById('street').value.trim(),
                apartment: document.getElementById('apartment').value.trim(),
                city: document.getElementById('city').value.trim(),
                state: document.getElementById('state').value.trim(),
                zipCode: document.getElementById('zipCode').value.trim(),
                country: document.getElementById('country').value.trim()
            },
            billingAddress: { sameAsShipping: true },
            paymentMethod: 'COD',
            notes: document.getElementById('notes').value.trim(),
            subtotal: cartData.subtotal,
            tax: cartData.tax,
            shipping: cartData.shipping,
            total: cartData.total
        };

        const btn = document.getElementById('placeOrderBtn');
        btn.disabled = true;
        btn.innerHTML = '<span class="spinner"></span> Placing Order...';

        try {
            const response = await OrderAPI.placeOrder(orderData);
            
            if (response.success) {
                Toast.success('Order placed successfully!');
                
                // Clear cart
                if (Auth.isLoggedIn()) {
                    await CartAPI.clearCart();
                } else {
                    Cart.clearLocalCart();
                }

                // Redirect to order confirmation
                setTimeout(() => {
                    window.location.href = `order-confirmation.html?orderId=${response.data.orderId}`;
                }, 1000);
            } else {
                Toast.error(response.message || 'Failed to place order');
                btn.disabled = false;
                btn.textContent = 'Place Order (COD)';
            }
        } catch (error) {
            console.error('Place order error:', error);
            Toast.error('An error occurred. Please try again.');
            btn.disabled = false;
            btn.textContent = 'Place Order (COD)';
        }
    });
}

// Start
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}
