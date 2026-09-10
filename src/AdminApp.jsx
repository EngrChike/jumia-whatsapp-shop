import React, { useState, useEffect } from 'react';
import { supabase } from './utils/supabaseClient';
import { ShieldCheck, Trash2, Pencil, LogOut, Users, Package, Phone, CheckCircle, X, DollarSign, TrendingUp, Layers, Eye, Archive, RotateCcw } from 'lucide-react';

export default function AdminApp() {
  const [session, setSession] = useState(null);
  const [adminEmail, setAdminEmail] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [authError, setAuthError] = useState('');
  const [authLoading, setAuthLoading] = useState(false);

  const [activeTab, setActiveTab] = useState('inventory'); // 'inventory', 'customers', or 'storefront'
  const [products, setProducts] = useState([]);
  const [selectedBatchFilter, setSelectedBatchFilter] = useState('ALL');
  const [showArchived, setShowArchived] = useState(false);

  // Inventory states
  const [name, setName] = useState('');
  const [price, setPrice] = useState('');
  const [costPrice, setCostPrice] = useState('');
  const [quantity, setQuantity] = useState('');
  const [initialQuantity, setInitialQuantity] = useState('');
  const [description, setDescription] = useState('');
  const [batch, setBatch] = useState('');
  const [imageFile, setImageFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);

  // Customer Ledger
  const [customers, setCustomers] = useState([]);
  const [editingCustomer, setEditingCustomer] = useState(null);
  const [editingSale, setEditingSale] = useState(null); // NEW: State for editing a sale

  const [ledgerForm, setLedgerForm] = useState({ 
    customerId: '', 
    newName: '', 
    newPhone: '', 
    initialPaid: '' 
  });
  
  // Cart Holder States
  const [cartItems, setCartItems] = useState(() => {
    try {
      const savedCart = localStorage.getItem('akuDonCart');
      return savedCart ? JSON.parse(savedCart) : [];
    } catch (error) {
      return [];
    }
  });
  const [cartProductId, setCartProductId] = useState('');
  const [cartQty, setCartQty] = useState('1');

  const [paymentForm, setPaymentForm] = useState({ amount: '', customerId: null });

  useEffect(() => {
    localStorage.setItem('akuDonCart', JSON.stringify(cartItems));
  }, [cartItems]);

  // FIX: Only fetch data when a session actually exists to prevent the "zero data" login bug
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session) {
        fetchProducts();
        fetchCustomersFromSupabase();
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session) {
        fetchProducts();
        fetchCustomersFromSupabase();
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const fetchProducts = async () => {
    try {
      const { data, error } = await supabase.from('products').select('*').order('created_at', { ascending: false });
      if (!error && data) setProducts(data);
    } catch (err) {
      console.error("Erreur produits: ", err);
    }
  };

  const fetchCustomersFromSupabase = async () => {
    try {
      const { data, error } = await supabase
        .from('customers')
        .select('*, customer_history(*)')
        .order('created_at', { ascending: false });

      if (error) throw error;
      if (data) {
        const formatted = data.map(c => ({
          id: c.id,
          name: c.name,
          phone: c.phone,
          totalDebt: c.total_debt || 0,
          history: c.customer_history ? c.customer_history.sort((a, b) => b.id - a.id) : []
        }));
        setCustomers(formatted);
      }
    } catch (err) {
      console.error("Erreur chargement clients Supabase:", err.message);
    }
  };

  const handleAdminLogin = async (e) => {
    e.preventDefault();
    setAuthError('');
    setAuthLoading(true);
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email: adminEmail, password: adminPassword });
      if (error) setAuthError(error.message);
      else { setAdminEmail(''); setAdminPassword(''); }
    } catch (err) {
      setAuthError('Erreur inattendue.');
    } finally {
      setAuthLoading(false);
    }
  };

  const handleAdminLogout = async () => await supabase.auth.signOut();

  const compressImage = (file, maxWidth = 800, maxHeight = 800, quality = 0.75) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = (event) => {
        const img = new Image();
        img.src = event.target.result;
        img.onload = () => {
          const canvas = document.createElement('canvas');
          let width = img.width; let height = img.height;
          if (width > height) { if (width > maxWidth) { height = Math.round((height * maxWidth) / width); width = maxWidth; } }
          else { if (height > maxHeight) { width = Math.round((width * maxHeight) / height); height = maxHeight; } }
          canvas.width = width; canvas.height = height;
          const ctx = canvas.getContext('2d'); ctx.drawImage(img, 0, 0, width, height);
          canvas.toBlob((blob) => {
            if (blob) resolve(new File([blob], file.name, { type: 'image/jpeg', lastModified: Date.now() }));
            else reject(new Error('Compression failed'));
          }, 'image/jpeg', quality);
        }; img.onerror = (err) => reject(err);
      }; reader.onerror = (err) => reject(err);
    });
  };

  const handleSaveProduct = async (e) => {
    e.preventDefault();
    if (!name || !price || quantity === '' || !batch) return;
    setUploading(true);
    let image_url = editingProduct ? editingProduct.image_url : 'https://images.unsplash.com/photo-1596462502278-27bfdc403348?auto=format&fit=crop&w=600&q=80';
    try {
      if (imageFile) {
        let fileToUpload = await compressImage(imageFile, 800, 800, 0.75);
        const fileName = `${Date.now()}_${fileToUpload.name.replace(/[^a-zA-Z0-9.]/g, '_')}`;
        const { error: upErr } = await supabase.storage.from('product-images').upload(fileName, fileToUpload, { upsert: false });
        if (!upErr) {
          const { data } = supabase.storage.from('product-images').getPublicUrl(fileName);
          if (data?.publicUrl) image_url = data.publicUrl;
        }
      }
      const parsedQty = parseInt(quantity) || 0;
      const parsedInitQty = initialQuantity !== '' ? parseInt(initialQuantity) : (editingProduct ? editingProduct.initial_quantity : parsedQty);

      const payload = { 
        name: name.trim(), 
        description: description.trim(), 
        price: parseFloat(price),
        cost_price: parseFloat(costPrice) || 0,
        image_url, 
        quantity: parsedQty, 
        initial_quantity: parsedInitQty || parsedQty,
        stock_status: parsedQty > 0, 
        batch_reference: batch.trim().toUpperCase(),
        is_archived: false
      };

      if (editingProduct) {
        const { error } = await supabase.from('products').update(payload).eq('id', editingProduct.id);
        if (error) throw error;
        alert('Produit mis à jour avec succès !');
      } else {
        const { error } = await supabase.from('products').insert([payload]);
        if (error) throw error;
        alert('Produit publié avec succès !');
      }

      setName(''); setPrice(''); setCostPrice(''); setQuantity(''); setInitialQuantity(''); setDescription(''); setBatch(''); setImageFile(null); setEditingProduct(null);
      await fetchProducts();
    } catch (err) { alert(`Erreur: ${err.message}`); }
    finally { setUploading(false); }
  };

  const handleStartEditProduct = (p) => {
    setEditingProduct(p);
    setName(p.name);
    setPrice(p.price);
    setCostPrice(p.cost_price || '');
    setQuantity(p.quantity);
    setInitialQuantity(p.initial_quantity !== undefined && p.initial_quantity !== null ? p.initial_quantity : p.quantity);
    setDescription(p.description || '');
    setBatch(p.batch_reference || '');
  };

  const handleCancelEditProduct = () => {
    setEditingProduct(null);
    setName(''); setPrice(''); setCostPrice(''); setQuantity(''); setInitialQuantity(''); setDescription(''); setBatch(''); setImageFile(null);
  };

  const handleUpdateStockVolume = async (id, newVolume) => {
    const parsedVolume = parseInt(newVolume) || 0;
    const { error } = await supabase.from('products').update({ quantity: parsedVolume, stock_status: parsedVolume > 0 }).eq('id', id);
    if (!error) setProducts(prev => prev.map(p => String(p.id) === String(id) ? { ...p, quantity: parsedVolume, stock_status: parsedVolume > 0 } : p));
  };

  const handleArchiveProduct = async (id, archiveState = true) => {
    const confirmMsg = archiveState 
      ? 'Voulez-vous archiver ce produit ? Il conservera ses données financières mais ne sera plus actif.' 
      : 'Voulez-vous restaurer ce produit dans le catalogue actif ?';
    if (!window.confirm(confirmMsg)) return;

    const { error } = await supabase.from('products').update({ is_archived: archiveState }).eq('id', id);
    if (!error) {
      setProducts(prev => prev.map(p => String(p.id) === String(id) ? { ...p, is_archived: archiveState } : p));
    } else {
      alert(`Erreur d'archivage: ${error.message}`);
    }
  };

  const handleAddToCart = () => {
    if (!cartProductId) return;
    const prod = products.find(p => String(p.id) === String(cartProductId));
    if (!prod || prod.is_archived) return;
    const qty = parseInt(cartQty) || 1;

    if (qty > prod.quantity) {
      alert(`Quantité sélectionnée supérieure au stock disponible (${prod.quantity}).`);
      return;
    }

    const existingIndex = cartItems.findIndex(item => String(item.productId) === String(prod.id));
    if (existingIndex > -1) {
      const updated = [...cartItems];
      updated[existingIndex].qty += qty;
      setCartItems(updated);
    } else {
      setCartItems([...cartItems, {
        productId: prod.id,
        name: prod.name,
        batch: prod.batch_reference || 'N/A',
        price: prod.price,
        qty: qty
      }]);
    }
    setCartProductId('');
    setCartQty('1');
  };

  const handleRemoveFromCart = (index) => setCartItems(cartItems.filter((_, i) => i !== index));

  const handleUpdateCartItemQty = (index, newQty) => {
    const qty = parseInt(newQty) || 0;
    const updated = [...cartItems];
    updated[index].qty = qty;
    setCartItems(updated);
  };

  const handleUpdateCartItemPrice = (index, newPrice) => {
    const price = parseFloat(newPrice) || 0;
    const updated = [...cartItems];
    updated[index].price = price;
    setCartItems(updated);
  };

  const cartTotal = cartItems.reduce((sum, item) => sum + (item.price * item.qty), 0);
  const paidAmount = parseFloat(ledgerForm.initialPaid) || 0;
  const remainingDebt = Math.max(0, cartTotal - paidAmount);

  const handleFinalizeSale = async (e) => {
    e.preventDefault();
    if (cartItems.length === 0) { alert("Veuillez ajouter au moins un article au panier."); return; }
    if (!ledgerForm.customerId) { alert("Veuillez sélectionner un client."); return; }

    try {
      const balance = remainingDebt;
      const goodsDescription = cartItems.map(item => `${item.qty}x ${item.name} (${item.batch})`).join(', ');
      const currentDate = new Date().toISOString().split('T')[0];
      let targetCustomerId = ledgerForm.customerId;

      if (ledgerForm.customerId === 'new') {
        const { data: newCustData, error: custErr } = await supabase.from('customers').insert([{
          name: ledgerForm.newName.trim(), phone: ledgerForm.newPhone.trim(), total_debt: balance
        }]).select().single();
        if (custErr) throw custErr;
        targetCustomerId = newCustData.id;
      } else {
        const existingCust = customers.find(c => String(c.id) === String(ledgerForm.customerId));
        const currentDebt = existingCust ? parseFloat(existingCust.totalDebt) || 0 : 0;
        const { error: updateErr } = await supabase.from('customers').update({ total_debt: currentDebt + balance }).eq('id', targetCustomerId);
        if (updateErr) throw updateErr;
      }

      const { error: histErr } = await supabase.from('customer_history').insert([{
        customer_id: targetCustomerId, date: currentDate, batch: cartItems.length === 1 ? cartItems[0].batch : 'MULTI-BATCH',
        product_id: cartItems.length === 1 ? cartItems[0].productId : null, qty: cartItems.reduce((sum, item) => sum + item.qty, 0),
        goods: goodsDescription, total: cartTotal, paid: paidAmount, type: 'Sale', items: cartItems
      }]);
      if (histErr) throw histErr;

      for (const item of cartItems) {
        if (item.productId) {
          const selectedProd = products.find(p => String(p.id) === String(item.productId));
          if (selectedProd) {
            const newStock = Math.max(0, selectedProd.quantity - item.qty);
            await supabase.from('products').update({ quantity: newStock, stock_status: newStock > 0 }).eq('id', selectedProd.id);
          }
        }
      }

      setLedgerForm({ customerId: '', newName: '', newPhone: '', initialPaid: '' });
      setCartItems([]);
      localStorage.removeItem('akuDonCart');
      await fetchProducts();
      await fetchCustomersFromSupabase();
      alert('Vente enregistrée avec succès !');
    } catch (err) { alert(`Erreur lors de l'enregistrement: ${err.message}`); }
  };

  // --- NEW: DELETE SALE & RESTORE STOCK ---
  const handleDeleteSale = async (customerId, historyRecord) => {
    if (!historyRecord.items || historyRecord.items.length === 0) {
      alert("Impossible d'annuler cette ancienne vente car les détails des articles sont manquants.");
      return;
    }
  
    if (!window.confirm("Voulez-vous vraiment annuler cette vente ? Les articles retourneront en stock et la dette sera recalculée.")) return;
  
    try {
      // 1. Restore Stock
      for (const item of historyRecord.items) {
        if (item.productId) {
          const prod = products.find(p => String(p.id) === String(item.productId));
          if (prod) {
            const newStock = prod.quantity + item.qty;
            await supabase.from('products').update({ quantity: newStock, stock_status: newStock > 0 }).eq('id', prod.id);
          }
        }
      }
  
      // 2. Adjust Customer Debt
      const customer = customers.find(c => String(c.id) === String(customerId));
      const originalDebtAdded = (parseFloat(historyRecord.total) || 0) - (parseFloat(historyRecord.paid) || 0);
      const newDebt = Math.max(0, (parseFloat(customer?.totalDebt) || 0) - originalDebtAdded);
  
      // 3. Check if customer should be deleted
      if (customer && customer.history.length === 1) {
        if (window.confirm("C'est la seule transaction de ce client. Voulez-vous également supprimer ce client de la base de données ?")) {
          await supabase.from('customers').delete().eq('id', customerId);
        } else {
          await supabase.from('customers').update({ total_debt: newDebt }).eq('id', customerId);
        }
      } else {
        await supabase.from('customers').update({ total_debt: newDebt }).eq('id', customerId);
      }
  
      // 4. Delete History Record
      await supabase.from('customer_history').delete().eq('id', historyRecord.id);
  
      alert('Vente annulée avec succès. Le stock a été mis à jour.');
      fetchProducts();
      fetchCustomersFromSupabase();
    } catch (error) {
      alert(`Erreur lors de l'annulation: ${error.message}`);
    }
  };

  // --- NEW: EDIT SALE QUANTITY & ADJUST STOCK ---
  const handleSaveSaleEdit = async (e) => {
    e.preventDefault();
    try {
      let newTotal = 0;
      let newTotalQty = 0;
      const updatedItems = [];

      for (const editedItem of editingSale.items) {
        const originalItem = editingSale.originalItems.find(i => String(i.productId) === String(editedItem.productId));
        const originalQty = originalItem ? originalItem.qty : 0;
        const qtyDiff = originalQty - editedItem.qty;

        if (qtyDiff !== 0) {
          const prod = products.find(p => String(p.id) === String(editedItem.productId));
          if (prod) {
            const newStock = prod.quantity + qtyDiff;
            if (newStock < 0) throw new Error(`Stock insuffisant pour ${prod.name}`);
            await supabase.from('products').update({ quantity: newStock, stock_status: newStock > 0 }).eq('id', prod.id);
          }
        }

        newTotal += (editedItem.price * editedItem.qty);
        newTotalQty += editedItem.qty;
        
        if (editedItem.qty > 0) {
          updatedItems.push(editedItem);
        }
      }

      // Calculate Debt Difference
      const originalDebtAdded = editingSale.total - editingSale.paid;
      const newDebtAdded = newTotal - editingSale.paid;
      const debtDifference = originalDebtAdded - newDebtAdded; 

      const customer = customers.find(c => String(c.id) === String(editingSale.customerId));
      const newCustomerDebt = Math.max(0, customer.totalDebt - debtDifference);
      
      await supabase.from('customers').update({ total_debt: newCustomerDebt }).eq('id', customer.id);

      const goodsDescription = updatedItems.map(item => `${item.qty}x ${item.name} (${item.batch})`).join(', ');

      await supabase.from('customer_history').update({
        items: updatedItems,
        total: newTotal,
        qty: newTotalQty,
        goods: goodsDescription || 'Aucun article (Remboursé)'
      }).eq('id', editingSale.id);

      alert('Vente modifiée avec succès. Le stock et les dettes ont été mis à jour.');
      setEditingSale(null);
      fetchProducts();
      fetchCustomersFromSupabase();
    } catch(err) {
      alert(`Erreur de modification: ${err.message}`);
    }
  };

  const handleRecordPayment = async (e, customerId, currentDebt) => {
    e.preventDefault();
    const payAmt = parseFloat(paymentForm.amount) || 0;
    if (payAmt <= 0) return;
    try {
      const newDebt = Math.max(0, currentDebt - payAmt);
      const { error: updateErr } = await supabase.from('customers').update({ total_debt: newDebt }).eq('id', customerId);
      if (updateErr) throw updateErr;

      const { error: histErr } = await supabase.from('customer_history').insert([{
        customer_id: customerId, date: new Date().toLocaleString(), type: 'Payment', paid: payAmt,
        goods: 'Debt Reconciliation', total: 0, qty: 0, items: []
      }]);
      if (histErr) throw histErr;

      setPaymentForm({ amount: '', customerId: null });
      await fetchCustomersFromSupabase();
      alert('Paiement enregistré !');
    } catch (err) { alert(`Erreur de paiement: ${err.message}`); }
  };

  const handleSaveCustomerEdit = async (e) => {
    e.preventDefault();
    if (!editingCustomer) return;
    try {
      const { error } = await supabase.from('customers').update({
        name: editingCustomer.name.trim(), phone: editingCustomer.phone.trim()
      }).eq('id', editingCustomer.id);
      if (error) throw error;
      setEditingCustomer(null);
      await fetchCustomersFromSupabase();
      alert('Informations client mises à jour !');
    } catch (err) { alert(`Erreur mise à jour client: ${err.message}`); }
  };

  const getProductSoldQty = (productId) => {
    return customers.reduce((acc, c) => {
      return acc + (c.history || []).reduce((hAcc, h) => {
        if (h.items && Array.isArray(h.items)) {
          const item = h.items.find(i => String(i.productId) === String(productId));
          return hAcc + (item ? (parseInt(item.qty) || 0) : 0);
        } else {
          if (String(h.productId) === String(productId)) return hAcc + (parseInt(h.qty) || 1);
        }
        return hAcc;
      }, 0);
    }, 0);
  };

  const getTrueInitialQty = (p) => {
    if (p.initial_quantity !== undefined && p.initial_quantity !== null && p.initial_quantity !== '') return parseInt(p.initial_quantity);
    return (parseInt(p.quantity) || 0) + getProductSoldQty(p.id);
  };

  const totalInventoryCost = products.reduce((acc, p) => acc + ((parseFloat(p.cost_price) || 0) * getTrueInitialQty(p)), 0);
  const totalExpectedRevenue = products.reduce((acc, p) => acc + ((parseFloat(p.price) || 0) * getTrueInitialQty(p)), 0);
  const totalPotentialRetail = products.filter(p => !p.is_archived).reduce((acc, p) => acc + ((parseFloat(p.price) || 0) * (parseInt(p.quantity) || 0)), 0);
  const totalGoodsSoldCost = products.reduce((acc, p) => acc + ((parseFloat(p.cost_price) || 0) * getProductSoldQty(p.id)), 0);
  const totalSalesRevenue = customers.reduce((acc, c) => acc + (c.history || []).reduce((hAcc, h) => hAcc + (parseFloat(h.total) || 0), 0), 0);
  const totalOutstandingDebt = customers.reduce((acc, c) => acc + (parseFloat(c.totalDebt) || 0), 0);

  const uniqueBatches = ['ALL', ...new Set(products.map(p => p.batch_reference).filter(Boolean))];
  const filteredProducts = products.filter(p => {
    const matchesBatch = selectedBatchFilter === 'ALL' || p.batch_reference === selectedBatchFilter;
    const matchesArchiveState = showArchived ? p.is_archived : !p.is_archived;
    return matchesBatch && matchesArchiveState;
  });

  const frontPageProducts = products.filter(p => {
    const qty = parseInt(p.quantity);
    return !p.is_archived && !isNaN(qty) && qty >= 1;
  });

  if (!session) {
    return (
      <div className="min-h-screen bg-[#f5f5f7] flex items-center justify-center p-4">
        <div className="w-full max-w-sm bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
          <div className="text-center mb-5">
            <h2 className="text-lg font-bold text-gray-900">Connexion Admin</h2>
            <p className="text-xs text-gray-500 mt-1">AkuDon Cosmetics Ventures - Admin Portal</p>
            {authError && <p className="text-red-500 text-xs mt-2 font-medium bg-red-50 p-2 rounded-lg">{authError}</p>} 
          </div>
          <form onSubmit={handleAdminLogin} className="space-y-4">
            <div>
              <label className="text-[10px] font-bold uppercase text-gray-500 block mb-1">Adresse Email</label>
              <input type="email" value={adminEmail} onChange={e => setAdminEmail(e.target.value)} className="w-full border p-2.5 rounded-xl text-xs" required />
            </div>
            <div>
              <label className="text-[10px] font-bold uppercase text-gray-500 block mb-1">Mot de passe</label>
              <input type="password" value={adminPassword} onChange={e => setAdminPassword(e.target.value)} className="w-full border p-2.5 rounded-xl text-xs" required />
            </div>
            <button type="submit" disabled={authLoading} className="w-full bg-zinc-950 hover:bg-zinc-800 text-white text-xs font-bold py-2.5 rounded-xl uppercase tracking-wider">{authLoading ? 'Connexion...' : 'Se connecter'}</button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f5f5f7] text-gray-900 font-sans p-3 sm:p-6 lg:p-8 relative">
      <div className="max-w-7xl mx-auto space-y-6">
        
        {/* HEADER */}
        <div className="flex flex-col sm:flex-row justify-between items-center gap-4 bg-white p-4 rounded-xl border border-gray-200 shadow-xs">
          <div className="flex flex-wrap gap-2 w-full sm:w-auto">
            <button onClick={() => setActiveTab('inventory')} className={`flex-1 sm:flex-none px-4 py-2 text-xs sm:text-sm font-bold rounded-lg flex items-center justify-center space-x-2 ${activeTab === 'inventory' ? 'bg-[#f68b1e] text-white' : 'bg-gray-100 text-gray-600'}`}>
              <Package className="w-4 h-4" /> <span>Inventory & Batches</span>
            </button>
            <button onClick={() => setActiveTab('customers')} className={`flex-1 sm:flex-none px-4 py-2 text-xs sm:text-sm font-bold rounded-lg flex items-center justify-center space-x-2 ${activeTab === 'customers' ? 'bg-[#f68b1e] text-white' : 'bg-gray-100 text-gray-600'}`}>
              <Users className="w-4 h-4" /> <span>Customer Ledger & Cart</span>
            </button>
            <button onClick={() => setActiveTab('storefront')} className={`flex-1 sm:flex-none px-4 py-2 text-xs sm:text-sm font-bold rounded-lg flex items-center justify-center space-x-2 ${activeTab === 'storefront' ? 'bg-[#f68b1e] text-white' : 'bg-gray-100 text-gray-600'}`}>
              <Eye className="w-4 h-4" /> <span>Front-Page Preview</span>
            </button>
          </div>
          <button onClick={handleAdminLogout} className="w-full sm:w-auto px-3 py-1.5 text-xs font-bold bg-red-50 text-red-600 rounded-lg hover:bg-red-100 flex items-center justify-center space-x-1.5">
            <LogOut className="w-3.5 h-3.5" /> <span>Déconnexion</span>
          </button>
        </div>

        {/* FINANCIAL METRICS */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4">
          <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-xs">
            <p className="text-[10px] font-extrabold uppercase text-gray-400">Total Achat Initial</p>
            <p className="text-sm sm:text-lg font-black text-gray-900 mt-1">{totalInventoryCost.toLocaleString()} FCFA</p>
          </div>
          <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-xs">
            <p className="text-[10px] font-extrabold uppercase text-gray-400">Total Vente Initiale</p>
            <p className="text-sm sm:text-lg font-black text-indigo-600 mt-1">{totalExpectedRevenue.toLocaleString()} FCFA</p>
          </div>
          <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-xs">
            <p className="text-[10px] font-extrabold uppercase text-gray-400">Valeur Stock Actuel</p>
            <p className="text-sm sm:text-lg font-black text-orange-600 mt-1">{totalPotentialRetail.toLocaleString()} FCFA</p>
          </div>
          <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-xs">
            <p className="text-[10px] font-extrabold uppercase text-gray-400">Coût March. Vendues</p>
            <p className="text-sm sm:text-lg font-black text-purple-600 mt-1">{totalGoodsSoldCost.toLocaleString()} FCFA</p>
          </div>
          <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-xs">
            <p className="text-[10px] font-extrabold uppercase text-gray-400">Total Ventes</p>
            <p className="text-sm sm:text-lg font-black text-blue-600 mt-1">{totalSalesRevenue.toLocaleString()} FCFA</p>
          </div>
          <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-xs">
            <p className="text-[10px] font-extrabold uppercase text-gray-400">Dettes Restantes</p>
            <p className="text-sm sm:text-lg font-black text-red-600 mt-1">{totalOutstandingDebt.toLocaleString()} FCFA</p>
          </div>
        </div>

        {/* TAB 1: INVENTORY */}
        {activeTab === 'inventory' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm h-fit">
              <div className="flex justify-between items-center mb-4 pb-2 border-b">
                <h3 className="font-bold text-xs uppercase tracking-wide text-gray-700">
                  {editingProduct ? 'Modifier le produit' : 'Ajouter un produit'}
                </h3>
                {editingProduct && (
                  <button onClick={handleCancelEditProduct} className="text-gray-400 hover:text-red-500 text-xs flex items-center">
                    <X className="w-3.5 h-3.5 mr-1" /> Annuler
                  </button>
                )}
              </div>
              <form onSubmit={handleSaveProduct} className="space-y-3.5">
                <input type="text" placeholder="Nom du produit" value={name} onChange={e => setName(e.target.value)} className="w-full border p-2.5 text-xs rounded-lg" required />
                <input type="text" placeholder="Batch Reference (e.g., BATCH-A)" value={batch} onChange={e => setBatch(e.target.value)} className="w-full border p-2.5 text-xs rounded-lg uppercase" required />
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[10px] text-gray-400 font-bold block mb-1">Prix Achat (Cost)</label>
                    <input type="number" placeholder="Cost" value={costPrice} onChange={e => setCostPrice(e.target.value)} className="w-full border p-2.5 text-xs rounded-lg" required />
                  </div>
                  <div>
                    <label className="text-[10px] text-gray-400 font-bold block mb-1">Prix Vente (Retail)</label>
                    <input type="number" placeholder="Selling" value={price} onChange={e => setPrice(e.target.value)} className="w-full border p-2.5 text-xs rounded-lg" required />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[10px] text-gray-400 font-bold block mb-1">Qté Initiale Achetée</label>
                    <input type="number" placeholder="Initial" value={initialQuantity} onChange={e => setInitialQuantity(e.target.value)} className="w-full border p-2.5 text-xs rounded-lg" />
                  </div>
                  <div>
                    <label className="text-[10px] text-gray-400 font-bold block mb-1">Qté Actuelle Stock</label>
                    <input type="number" placeholder="Stock" value={quantity} onChange={e => setQuantity(e.target.value)} className="w-full border p-2.5 text-xs rounded-lg" required />
                  </div>
                </div>
                <textarea placeholder="Description" value={description} onChange={e => setDescription(e.target.value)} className="w-full border p-2.5 text-xs rounded-lg h-16" />
                <input type="file" accept="image/*" onChange={e => setImageFile(e.target.files[0])} className="w-full text-xs text-gray-500" />
                <button type="submit" disabled={uploading} className="w-full bg-[#f68b1e] text-white text-xs py-3 rounded-lg font-bold uppercase tracking-wider">
                  {uploading ? 'Traitement...' : editingProduct ? 'Enregistrer les modifications' : 'Publier le produit'}
                </button>
              </form>
            </div>

            <div className="lg:col-span-2 bg-white p-5 rounded-xl border border-gray-200 shadow-sm space-y-4">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center pb-3 border-b gap-3">
                <h3 className="font-bold text-xs uppercase tracking-wide text-gray-700 flex items-center">
                  <Layers className="w-4 h-4 mr-1.5 text-orange-600" /> Catalogue des Produits
                </h3>
                <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
                  <button onClick={() => setShowArchived(!showArchived)} className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1 ${showArchived ? 'bg-purple-100 text-purple-700' : 'bg-gray-100 text-gray-600'}`}>
                    <Archive className="w-3.5 h-3.5" /> <span>{showArchived ? 'Voir Actifs' : 'Voir Archivés'}</span>
                  </button>
                  <select value={selectedBatchFilter} onChange={e => setSelectedBatchFilter(e.target.value)} className="border p-1.5 text-xs rounded-lg bg-gray-50 font-bold">
                    {uniqueBatches.map(b => <option key={b} value={b}>{b}</option>)}
                  </select>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs min-w-[600px]">
                  <thead>
                    <tr className="bg-gray-50 text-gray-400 font-bold border-b">
                      <th className="p-2.5">Image</th>
                      <th className="p-2.5">Article</th>
                      <th className="p-2.5">Batch</th>
                      <th className="p-2.5">Achat (Cost)</th>
                      <th className="p-2.5">Vente (Price)</th>
                      <th className="p-2.5 text-center">Stock Actuel</th>
                      <th className="p-2.5 text-center">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {filteredProducts.map((p) => (
                      <tr key={p.id} className={`hover:bg-gray-50/50 ${p.is_archived ? 'opacity-60 bg-gray-50' : ''}`}>
                        <td className="p-2.5"><img src={p.image_url} alt={p.name} className="w-10 h-10 object-cover rounded-lg border" /></td>
                        <td className="p-2.5 font-extrabold">{p.name} {p.is_archived && <span className="ml-2 text-[9px] bg-gray-200 text-gray-700 font-bold px-1.5 py-0.5 rounded">Archivé</span>}</td>
                        <td className="p-2.5"><span className="bg-orange-100 text-orange-800 font-bold px-2 py-0.5 rounded text-[10px]">{p.batch_reference || 'N/A'}</span></td>
                        <td className="p-2.5 text-gray-500">{p.cost_price?.toLocaleString()} FCFA</td>
                        <td className="p-2.5 font-semibold text-orange-600">{p.price?.toLocaleString()} FCFA</td>
                        <td className="p-2.5 text-center"><input type="number" value={p.quantity !== null ? p.quantity : 0} onChange={(e) => handleUpdateStockVolume(p.id, e.target.value)} className="w-16 border text-center p-1 rounded font-bold" /></td>
                        <td className="p-2.5 text-center space-x-2">
                          <button onClick={() => handleStartEditProduct(p)} className="text-blue-500 hover:text-blue-700"><Pencil className="w-4 h-4 inline" /></button>
                          {p.is_archived ? (
                            <button onClick={() => handleArchiveProduct(p.id, false)} className="text-green-600 hover:text-green-800"><RotateCcw className="w-4 h-4 inline" /></button>
                          ) : (
                            <button onClick={() => handleArchiveProduct(p.id, true)} className="text-purple-600 hover:text-purple-800"><Archive className="w-4 h-4 inline" /></button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: LEDGER AND CART */}
        {activeTab === 'customers' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm h-fit space-y-4">
              <h3 className="font-bold text-xs uppercase tracking-wide text-gray-700 pb-2 border-b">Enregistrer une Vente</h3>
              <form onSubmit={handleFinalizeSale} className="space-y-4">
                <div>
                  <label className="text-[10px] text-gray-400 font-bold block mb-1">Sélectionner le Client (Supabase)</label>
                  <select value={ledgerForm.customerId} onChange={e => setLedgerForm({...ledgerForm, customerId: e.target.value})} className="w-full border p-2.5 text-xs rounded-lg" required>
                    <option value="">-- Choisir un Client --</option>
                    <option value="new">+ Enregistrer un Nouveau Client</option>
                    {customers.map(c => <option key={c.id} value={c.id}>{c.name} ({c.phone || 'N/A'})</option>)}
                  </select>
                </div>
                {ledgerForm.customerId === 'new' && (
                  <div className="space-y-3 p-3 bg-gray-50 rounded-lg border">
                    <input type="text" placeholder="Nom du Client" value={ledgerForm.newName} onChange={e => setLedgerForm({...ledgerForm, newName: e.target.value})} className="w-full border p-2 text-xs rounded-lg bg-white" required />
                    <input type="text" placeholder="Numéro de Téléphone (+225...)" value={ledgerForm.newPhone} onChange={e => setLedgerForm({...ledgerForm, newPhone: e.target.value})} className="w-full border p-2 text-xs rounded-lg bg-white" required />
                  </div>
                )}

                <div className="bg-gray-50 p-3.5 rounded-xl border space-y-3">
                  <label className="text-[10px] text-gray-500 font-bold uppercase block">Ajouter des articles</label>
                  <div className="grid grid-cols-1 gap-2">
                    <select value={cartProductId} onChange={e => setCartProductId(e.target.value)} className="w-full border p-2 text-xs rounded-lg bg-white">
                      <option value="">-- Choisir un produit --</option>
                      {products.filter(p => !p.is_archived).map(p => (
                        <option key={p.id} value={p.id}>[{p.batch_reference}] {p.name} - {p.price?.toLocaleString()} (Stock: {p.quantity})</option>
                      ))}
                    </select>
                    <div className="flex space-x-2">
                      <input type="number" min="1" placeholder="Qté" value={cartQty} onChange={e => setCartQty(e.target.value)} className="w-20 border p-2 text-xs rounded-lg bg-white text-center font-bold" />
                      <button type="button" onClick={handleAddToCart} className="flex-1 bg-orange-600 text-white text-xs font-bold py-2 px-3 rounded-lg uppercase">+ Ajouter</button>
                    </div>
                  </div>

                  {cartItems.length > 0 && (
                    <div className="mt-3 bg-white rounded-lg border overflow-hidden">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-gray-100 text-gray-500 font-bold border-b">
                          <tr><th className="p-2">Article</th><th className="p-2 text-center">Qté</th><th className="p-2 text-right">Prix U.</th><th className="p-2 text-center">Act</th></tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                          {cartItems.map((item, index) => (
                            <tr key={index}>
                              <td className="p-2 font-bold">{item.name}</td>
                              <td className="p-2 text-center"><input type="number" min="1" value={item.qty} onChange={(e) => handleUpdateCartItemQty(index, e.target.value)} className="w-12 border text-center p-1 rounded font-bold text-xs" /></td>
                              <td className="p-2 text-right"><input type="number" value={item.price} onChange={(e) => handleUpdateCartItemPrice(index, e.target.value)} className="w-20 border text-right p-1 rounded font-bold text-xs" /></td>
                              <td className="p-2 text-center"><button type="button" onClick={() => handleRemoveFromCart(index)} className="text-red-500"><Trash2 className="w-4 h-4 inline" /></button></td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>

                <div>
                  <label className="text-[10px] text-gray-400 font-bold block mb-1">Montant Payé Initial (FCFA)</label>
                  <input type="number" placeholder="Payé mtn" value={ledgerForm.initialPaid} onChange={e => setLedgerForm({...ledgerForm, initialPaid: e.target.value})} className="w-full border p-2.5 text-xs rounded-lg" required />
                </div>

                {cartItems.length > 0 && (
                  <div className="p-3 bg-orange-50 border border-orange-200 rounded-lg text-xs space-y-1">
                    <div className="flex justify-between text-gray-600"><span>Total Panier:</span><span className="font-bold">{cartTotal.toLocaleString()} FCFA</span></div>
                    <div className="flex justify-between text-gray-600"><span>Montant Payé:</span><span className="font-bold text-green-600">{paidAmount.toLocaleString()} FCFA</span></div>
                    <div className="flex justify-between border-t border-orange-200 pt-1 text-orange-900 font-extrabold"><span>Ajouté à la Dette:</span><span>{remainingDebt.toLocaleString()} FCFA</span></div>
                  </div>
                )}
                <button type="submit" disabled={cartItems.length === 0} className="w-full bg-black hover:bg-gray-800 disabled:bg-gray-300 text-white text-xs py-3 rounded-lg font-bold uppercase tracking-wider">
                  Terminer & Enregistrer
                </button>
              </form>
            </div>

            <div className="lg:col-span-2 space-y-6">
              <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm">
                <h3 className="font-bold text-xs uppercase tracking-wide text-gray-700 mb-4 pb-2 border-b">Balances Clients & Historique</h3>
                
                {editingCustomer && (
                  <form onSubmit={handleSaveCustomerEdit} className="mb-4 p-4 bg-blue-50 border border-blue-200 rounded-xl space-y-3">
                    <div className="flex justify-between items-center">
                      <h4 className="font-bold text-xs text-blue-900 uppercase">Modifier Client</h4>
                      <button type="button" onClick={() => setEditingCustomer(null)} className="text-gray-400 hover:text-red-500 text-xs">Annuler</button>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <input type="text" value={editingCustomer.name} onChange={e => setEditingCustomer({...editingCustomer, name: e.target.value})} className="border p-2 text-xs rounded bg-white" required placeholder="Nom" />
                      <input type="text" value={editingCustomer.phone} onChange={e => setEditingCustomer({...editingCustomer, phone: e.target.value})} className="border p-2 text-xs rounded bg-white" required placeholder="Téléphone" />
                    </div>
                    <button type="submit" className="bg-blue-600 text-white text-xs px-4 py-1.5 rounded font-bold">Mettre à jour</button>
                  </form>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {customers.map(c => (
                    <div key={c.id} className="border rounded-xl p-4 bg-gray-50 flex flex-col justify-between space-y-3">
                      <div>
                        <div className="flex justify-between items-start mb-2">
                          <div>
                            <h4 className="font-black text-sm">{c.name}</h4>
                            <p className="text-[11px] text-gray-500 flex items-center mt-0.5"><Phone className="w-3 h-3 mr-1" /> {c.phone || 'Pas de téléphone'}</p>
                          </div>
                          <div className="flex items-center space-x-2">
                            <button onClick={() => setEditingCustomer(c)} className="text-gray-400 hover:text-blue-600"><Pencil className="w-3.5 h-3.5" /></button>
                            <span className={`text-[11px] font-bold px-2 py-0.5 rounded ${c.totalDebt > 0 ? 'bg-red-100 text-red-600' : 'bg-green-100 text-green-600'}`}>
                              Dette: {c.totalDebt.toLocaleString()} FCFA
                            </span>
                          </div>
                        </div>
                        
                        {c.totalDebt > 0 && (
                          <form onSubmit={(e) => handleRecordPayment(e, c.id, c.totalDebt)} className="mt-3 flex space-x-2">
                            <input type="number" placeholder="Montant du paiement" value={paymentForm.customerId === c.id ? paymentForm.amount : ''} onChange={e => setPaymentForm({ amount: e.target.value, customerId: c.id })} className="w-full border p-1.5 text-xs rounded bg-white" required />
                            <button type="submit" className="bg-green-600 text-white text-[10px] px-3 rounded font-bold whitespace-nowrap">Régler Dette</button>
                          </form>
                        )}
                      </div>

                      <div className="pt-2 border-t">
                        <p className="text-[10px] font-bold text-gray-400 mb-1">HISTORIQUE DES VENTES:</p>
                        <ul className="text-[10px] space-y-1.5 text-gray-600 max-h-40 overflow-y-auto pr-1">
                          {c.history.map((h, i) => (
                            <li key={i} className="bg-white p-2.5 rounded border border-gray-100 flex flex-col space-y-1.5 shadow-sm">
                              <div className="flex justify-between items-start">
                                <div>
                                  <span className="font-bold text-gray-700">{h.date}</span>
                                  <p className="text-gray-600 mt-0.5">{h.goods} <span className="text-orange-600 font-bold">({h.batch || h.type})</span></p>
                                </div>
                                <div className="text-right whitespace-nowrap ml-2">
                                  <div>Total: <span className="font-bold">{h.total?.toLocaleString()}</span></div>
                                  <div>Payé: <span className="text-green-600 font-bold">{h.paid?.toLocaleString()}</span></div>
                                </div>
                              </div>
                              {/* ACTION BUTTONS FOR EDITING/DELETING SALES */}
                              {h.type === 'Sale' && h.items && h.items.length > 0 && (
                                <div className="flex space-x-3 pt-1.5 border-t border-gray-50 mt-1">
                                  <button onClick={() => setEditingSale({...h, customerId: c.id, originalItems: JSON.parse(JSON.stringify(h.items))})} className="text-blue-500 hover:text-blue-700 font-bold flex items-center">
                                    <Pencil className="w-3 h-3 mr-1"/> Modifier
                                  </button>
                                  <button onClick={() => handleDeleteSale(c.id, h)} className="text-red-500 hover:text-red-700 font-bold flex items-center">
                                    <Trash2 className="w-3 h-3 mr-1"/> Annuler Vente
                                  </button>
                                </div>
                              )}
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  ))}
                  {customers.length === 0 && (
                    <div className="col-span-full text-center py-12 text-gray-400 text-xs bg-gray-50 rounded-xl border border-dashed border-gray-200">
                      Aucun client enregistré.
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: STOREFRONT PREVIEW */}
        {activeTab === 'storefront' && (
          <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center pb-4 border-b gap-2">
              <div>
                <h3 className="font-black text-sm uppercase tracking-wide text-gray-900">Aperçu Front-Page (Catalogue Public)</h3>
                <p className="text-xs text-gray-500 mt-0.5">Seuls les articles non-archivés avec au moins 1 produit en stock (quantité &gt;= 1) sont affichés ici.</p>
              </div>
              <span className="bg-green-100 text-green-800 text-xs font-bold px-3 py-1 rounded-full">{frontPageProducts.length} articles visibles</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {frontPageProducts.map(p => (
                <div key={p.id} className="border border-gray-200 rounded-xl p-4 bg-white flex flex-col justify-between shadow-xs hover:shadow-md transition-shadow">
                  <div>
                    <img src={p.image_url} alt={p.name} className="w-full h-40 object-cover rounded-lg border mb-3" />
                    <span className="bg-orange-100 text-orange-800 font-bold px-2 py-0.5 rounded text-[10px] inline-block mb-1">{p.batch_reference || 'BATCH'}</span>
                    <h4 className="font-black text-sm text-gray-900 leading-tight">{p.name}</h4>
                    <p className="text-xs text-gray-500 mt-1 line-clamp-2">{p.description || 'Aucune description disponible.'}</p>
                  </div>
                  <div className="mt-4 pt-3 border-t border-gray-100 flex justify-between items-center">
                    <span className="font-black text-orange-600 text-sm">{p.price?.toLocaleString()} FCFA</span>
                    <span className="text-[11px] font-bold text-green-600 bg-green-50 px-2 py-1 rounded">Stock: {p.quantity} pcs</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

      </div>

      {/* EDITING SALE MODAL POPUP */}
      {editingSale && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-white p-6 rounded-xl w-full max-w-lg space-y-4 shadow-xl">
            <h3 className="font-black text-lg text-gray-900 border-b pb-2">Modifier les Quantités Achetées</h3>
            <div className="space-y-3 max-h-64 overflow-y-auto">
              {editingSale.items.map((item, index) => (
                <div key={index} className="flex justify-between items-center bg-gray-50 p-3 rounded-lg border">
                  <div>
                    <p className="font-bold text-sm">{item.name}</p>
                    <p className="text-[10px] text-gray-500">Prix unitaire: {item.price} FCFA</p>
                  </div>
                  <div className="flex items-center space-x-2">
                    <label className="text-xs font-bold text-gray-600">Qté:</label>
                    <input 
                      type="number" 
                      min="0" 
                      value={item.qty} 
                      onChange={(e) => {
                        const newItems = [...editingSale.items];
                        newItems[index].qty = parseInt(e.target.value) || 0;
                        setEditingSale({...editingSale, items: newItems});
                      }} 
                      className="w-16 border p-1.5 text-center text-sm rounded-lg font-bold"
                    />
                  </div>
                </div>
              ))}
            </div>
            <div className="bg-orange-50 p-3 rounded-lg border border-orange-200">
              <p className="text-xs text-orange-800 font-bold leading-relaxed">
                * Si vous réduisez la quantité, les articles seront automatiquement remis en stock. Si vous fixez la quantité à 0, l'article sera retiré. Les dettes de ce client seront recalculées.
              </p>
            </div>
            <div className="flex justify-end space-x-3 pt-2">
              <button onClick={() => setEditingSale(null)} className="px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-800 text-xs font-bold rounded-lg uppercase">Annuler</button>
              <button onClick={handleSaveSaleEdit} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-lg uppercase tracking-wide">Enregistrer & Ajuster</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}