import React, { useState, useEffect } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, signInWithCustomToken, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, collection, addDoc, getDocs, doc, deleteDoc, query, orderBy } from 'firebase/firestore';

// Firebase configuration (prioritize Canvas globals, then environment variables for build)
const firebaseConfig = typeof __firebase_config !== 'undefined'
  ? JSON.parse(__firebase_config)
  : JSON.parse(process.env.REACT_APP_FIREBASE_CONFIG || '{}');

const appId = typeof __app_id !== 'undefined'
  ? __app_id
  : process.env.REACT_APP_APP_ID || 'default-app-id';

const initialAuthToken = typeof __initial_auth_token !== 'undefined'
  ? __initial_auth_token
  : process.env.REACT_APP_INITIAL_AUTH_TOKEN || null;

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

// Main App component
const App = () => {
  // State for Firebase and user
  const [user, setUser] = useState(null);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [userId, setUserId] = useState(null);

  // State for the main window counter logic
  const [windowTypes, setWindowTypes] = useState([
    { id: 'sash', name: 'Sash Window', price: 0, count: 0 },
    { id: 'fw-small', name: 'FW (Small)', price: 0, count: 0 },
    { id: 'fw-medium', name: 'FW (Medium)', price: 0, count: 0 },
    { id: 'fw-large', name: 'FW (Large)', price: 0, count: 0 },
    { id: 'screen', name: 'Screen', price: 0, count: 0 },
  ]);
  const [newWindowName, setNewWindowName] = useState('');
  const [newWindowPrice, setNewWindowPrice] = useState('');

  // State for custom message box
  const [messageBox, setMessageBox] = useState({
    isVisible: false,
    message: '',
    onConfirm: null,
    onCancel: null,
  });

  // State for managing the edit modal
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingWindowId, setEditingWindowId] = useState(null);
  const [editingWindowName, setEditingWindowName] = useState('');
  const [editingWindowPrice, setEditingWindowPrice] = useState(''); // Corrected variable name

  // State to control visibility of add window input fields
  const [showAddWindowInputs, setShowAddWindowInputs] = useState(false);

  // State to keep track of the item currently being dragged
  const [draggedItemId, setDraggedItemId] = useState(null);

  // States for saving and loading quotes
  const [isSaveModalOpen, setIsSaveModalOpen] = useState(false);
  const [quoteNameToSave, setQuoteNameToSave] = useState('');
  const [savedQuotes, setSavedQuotes] = useState([]);
  const [isViewQuotesModalOpen, setIsViewQuotesModalOpen] = useState(false);
  const [isLoadingQuotes, setIsLoadingQuotes] = useState(false);
  const [isSavingQuote, setIsSavingQuote] = useState(false);


  // Firebase Authentication Effect
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        setUser(currentUser);
        setUserId(currentUser.uid);
        console.log("Firebase authenticated. User ID:", currentUser.uid);
      } else {
        // Sign in anonymously if no user is logged in
        try {
          if (initialAuthToken) {
            await signInWithCustomToken(auth, initialAuthToken);
            console.log("Signed in with custom token.");
          } else {
            await signInAnonymously(auth);
            console.log("Signed in anonymously.");
          }
        } catch (error) {
          console.error("Firebase authentication failed:", error);
          showMessageBox(`Authentication error: ${error.message}`);
        }
      }
      setIsAuthReady(true); // Mark auth as ready regardless of success or failure
    });

    return () => unsubscribe(); // Cleanup subscription
  }, []);

  // Calculate the total cost whenever windowTypes changes
  const totalCost = windowTypes.reduce((sum, windowType) => {
    return sum + (windowType.price * windowType.count);
  }, 0);

  // Function to add a new window type
  const addWindowType = () => {
    if (!newWindowName.trim()) {
      showMessageBox('Window name cannot be empty.');
      return;
    }
    const price = parseFloat(newWindowPrice);
    if (isNaN(price) || price < 0) {
      showMessageBox('Price must be a valid non-negative number.');
      return;
    }

    const newType = {
      id: Date.now(),
      name: newWindowName.trim(),
      price: price,
      count: 0,
    };

    setWindowTypes([...windowTypes, newType]);
    setNewWindowName('');
    setNewWindowPrice('');
    setShowAddWindowInputs(false);
  };

  // Function to increment a window type's count
  const incrementCount = (id) => {
    setWindowTypes(windowTypes.map(windowType =>
      windowType.id === id ? { ...windowType, count: windowType.count + 1 } : windowType
    ));
  };

  // Function to decrement a window type's count
  const decrementCount = (id) => {
    setWindowTypes(windowTypes.map(windowType =>
      windowType.id === id ? { ...windowType, count: Math.max(0, windowType.count - 1) } : windowType
    ));
  };

  // Function to open the edit modal with the selected window's data
  const openEditModal = (windowType) => {
    setEditingWindowId(windowType.id);
    setEditingWindowName(windowType.name);
    setEditingWindowPrice(windowType.price.toFixed(2));
    setIsEditModalOpen(true);
  };

  // Function to save changes from the edit modal
  const saveEditedWindow = () => {
    if (!editingWindowName.trim()) {
      showMessageBox('Window name cannot be empty.');
      return;
    }
    const price = parseFloat(editingWindowPrice);
    if (isNaN(price) || price < 0) {
      showMessageBox('Price must be a valid non-negative number.');
      return;
    }

    setWindowTypes(windowTypes.map(windowType =>
      windowType.id === editingWindowId
        ? { ...windowType, name: editingWindowName.trim(), price: price }
        : windowType
    ));
    setIsEditModalOpen(false);
    setEditingWindowId(null);
  };

  // Function to close the edit modal without saving
  const cancelEdit = () => {
    setIsEditModalOpen(false);
    setEditingWindowId(null);
  };

  // Function to delete a window type
  const deleteWindowType = (idToDelete) => {
    showMessageBox(
      'Are you sure you want to delete this window type?',
      () => {
        setWindowTypes(windowTypes.filter(windowType => windowType.id !== idToDelete));
        hideMessageBox();
      },
      () => hideMessageBox()
    );
  };

  // Function to display the custom message box
  const showMessageBox = (message, onConfirm = null, onCancel = null) => {
    setMessageBox({
      isVisible: true,
      message,
      onConfirm,
      onCancel,
    });
  };

  // Function to hide the custom message box
  const hideMessageBox = () => {
    setMessageBox({
      isVisible: false,
      message: '',
      onConfirm: null,
      onCancel: null,
    });
  };

  // Drag and Drop Handlers
  const handleDragStart = (e, id) => {
    setDraggedItemId(id);
    e.dataTransfer.setData("text/plain", id);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
  };

  const handleDrop = (e, targetId) => {
    e.preventDefault();
    if (draggedItemId === null || draggedItemId === targetId) {
      return;
    }

    const draggedItem = windowTypes.find(item => item.id === draggedItemId);
    const targetItem = windowTypes.find(item => item.id === targetId);

    if (draggedItem && targetItem) {
      const newWindowTypes = [...windowTypes];
      const draggedIndex = newWindowTypes.findIndex(item => item.id === draggedItemId);
      const targetIndex = newWindowTypes.findIndex(item => item.id === targetId);

      newWindowTypes.splice(draggedIndex, 1);
      newWindowTypes.splice(targetIndex, 0, draggedItem);

      setWindowTypes(newWindowTypes);
    }
    setDraggedItemId(null);
  };

  const handleDragEnd = () => {
    setDraggedItemId(null);
  };

  // --- Save/Load Quote Functions ---

  // Function to open the save quote modal
  const openSaveQuoteModal = () => {
    if (!isAuthReady || !userId) {
      showMessageBox("Please wait for authentication to complete before saving.");
      return;
    }
    setQuoteNameToSave(''); // Clear previous name
    setIsSaveModalOpen(true);
  };

  // Function to save the current quote to Firestore
  const saveCurrentQuote = async () => {
    if (!quoteNameToSave.trim()) {
      showMessageBox('Quote name cannot be empty.');
      return;
    }
    if (!userId) {
      showMessageBox('User not authenticated. Please try again.');
      return;
    }

    setIsSavingQuote(true);
    try {
      const quotesCollectionRef = collection(db, `artifacts/${appId}/public/data/quotes`);
      await addDoc(quotesCollectionRef, {
        name: quoteNameToSave.trim(),
        windowTypes: windowTypes, // Save the current window types state
        totalCost: totalCost,
        timestamp: new Date(),
        userId: userId, // Store the user ID for filtering/ownership
      });
      showMessageBox('Quote saved successfully!');
      setIsSaveModalOpen(false);
      setQuoteNameToSave('');
    } catch (error) {
      console.error("Error saving quote:", error);
      showMessageBox(`Failed to save quote: ${error.message}`);
    } finally {
      setIsSavingQuote(false);
    }
  };

  // Function to fetch saved quotes from Firestore
  const fetchSavedQuotes = async () => {
    if (!isAuthReady || !userId) {
      showMessageBox("Please wait for authentication to complete before viewing saved quotes.");
      return;
    }

    setIsLoadingQuotes(true);
    try {
      const quotesCollectionRef = collection(db, `artifacts/${appId}/public/data/quotes`);
      // Create a query to filter by userId and order by timestamp
      // Note: Firestore orderBy requires an index if not on the first field of a compound query.
      // For simplicity here, we'll fetch all and sort in memory if needed,
      // or rely on default Firestore order if no specific order is strictly required.
      // For production, consider adding Firestore indexes for `userId` and `timestamp`.
      const q = query(quotesCollectionRef); // No specific ordering for now to avoid index issues.
      const querySnapshot = await getDocs(q);
      const fetchedQuotes = [];
      querySnapshot.forEach((doc) => {
        const data = doc.data();
        // Filter by userId if you want only the current user's quotes
        // For public data, all users can see all quotes, but we store userId for reference.
        fetchedQuotes.push({ id: doc.id, ...data });
      });
      // Sort by timestamp if desired (client-side to avoid index issues)
      fetchedQuotes.sort((a, b) => b.timestamp.toDate() - a.timestamp.toDate());
      setSavedQuotes(fetchedQuotes);
      setIsViewQuotesModalOpen(true);
    } catch (error) {
      console.error("Error fetching quotes:", error);
      showMessageBox(`Failed to load quotes: ${error.message}`);
    } finally {
      setIsLoadingQuotes(false);
    }
  };

  // Function to load a selected quote into the main app state
  const loadSelectedQuote = (quote) => {
    showMessageBox(
      `Are you sure you want to load "${quote.name}"? This will replace your current quote.`,
      () => {
        setWindowTypes(quote.windowTypes || []); // Ensure it's an array
        setIsViewQuotesModalOpen(false);
        hideMessageBox();
      },
      () => hideMessageBox()
    );
  };

  // Function to delete a saved quote from Firestore
  const deleteSavedQuote = (quoteId) => {
    showMessageBox(
      'Are you sure you want to delete this saved quote?',
      async () => {
        try {
          const quoteDocRef = doc(db, `artifacts/${appId}/public/data/quotes`, quoteId);
          await deleteDoc(quoteDocRef);
          showMessageBox('Quote deleted successfully!');
          // Refresh the list of saved quotes
          fetchSavedQuotes();
        } catch (error) {
          console.error("Error deleting quote:", error);
          showMessageBox(`Failed to delete quote: ${error.message}`);
        } finally {
          hideMessageBox();
        }
      },
      () => hideMessageBox()
    );
  };


  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4 font-sans flex items-center justify-center">
      <div className="bg-white p-8 rounded-xl shadow-2xl w-full max-w-2xl border border-gray-200">
        <h1 className="text-4xl font-extrabold text-center text-gray-800 mb-8 tracking-tight">
          Window Counter
        </h1>

        {/* Add New Window Type Section */}
        <div className="mb-8 p-6 bg-blue-50 rounded-lg border border-blue-200 shadow-inner">
          {/* Removed the "Add New Window Type" heading */}
          {!showAddWindowInputs ? (
            <button
              onClick={() => setShowAddWindowInputs(true)}
              className="w-full bg-blue-600 text-white px-6 py-3 rounded-lg font-bold text-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition duration-200 ease-in-out shadow-md"
            >
              Create New Window Type
            </button>
          ) : (
            <div className="flex flex-col sm:flex-row gap-4 items-center">
              <input
                type="text"
                placeholder="Enter Window Name"
                value={newWindowName}
                onChange={(e) => setNewWindowName(e.target.value)}
                className="flex-1 p-3 border border-blue-300 rounded-lg focus:ring-2 focus:ring-blue-400 focus:border-transparent outline-none transition duration-200 ease-in-out w-full"
              />
              <input
                type="number"
                placeholder="Initial Price (e.g., 150.00)"
                value={newWindowPrice}
                onChange={(e) => setNewWindowPrice(e.target.value)}
                className="w-full sm:w-40 p-3 border border-blue-300 rounded-lg focus:ring-2 focus:ring-blue-400 focus:border-transparent outline-none transition duration-200 ease-in-out"
                step="0.01"
              />
              <button
                onClick={addWindowType}
                className="w-full sm:w-auto bg-blue-600 text-white px-6 py-3 rounded-lg font-bold text-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition duration-200 ease-in-out shadow-md"
              >
                Add Window
              </button>
            </div>
          )}
        </div>

        {/* Window Types List */}
        {windowTypes.length === 0 ? (
          <p className="text-center text-gray-600 text-lg py-8">No window types added yet. Add one above!</p>
        ) : (
          <div className="space-y-4">
            {windowTypes.map((windowType) => (
              <div
                key={windowType.id}
                draggable="true" // Make the div draggable
                onDragStart={(e) => handleDragStart(e, windowType.id)}
                onDragOver={handleDragOver}
                onDrop={(e) => handleDrop(e, windowType.id)}
                onDragEnd={handleDragEnd}
                className={`flex flex-col sm:flex-row items-center justify-between bg-gray-50 p-4 rounded-lg shadow-sm border border-gray-200 cursor-grab
                  ${draggedItemId === windowType.id ? 'opacity-50 border-dashed border-2 border-blue-400' : ''}
                `}
              >
                <div className="flex-1 text-center sm:text-left mb-2 sm:mb-0">
                  <h3 className="text-xl font-semibold text-gray-800">{windowType.name}</h3>
                  <p className="text-gray-600">Price: ${windowType.price.toFixed(2)}</p>
                </div>
                {/* Adjusted spacing here */}
                <div className="flex items-center space-x-4 mt-4 sm:mt-0">
                  <button
                    onClick={() => decrementCount(windowType.id)}
                    className="bg-red-500 text-white w-10 h-10 rounded-full flex items-center justify-center text-2xl font-bold hover:bg-red-600 focus:outline-none focus:ring-2 focus:ring-red-400 transition duration-200 ease-in-out shadow-sm"
                  >
                    -
                  </button>
                  <span className="text-3xl font-extrabold text-gray-900 w-12 text-center">
                    {windowType.count}
                  </span>
                  <button
                    onClick={() => incrementCount(windowType.id)}
                    className="bg-green-500 text-white w-10 h-10 rounded-full flex items-center justify-center text-2xl font-bold hover:bg-green-600 focus:outline-none focus:ring-2 focus:ring-green-400 transition duration-200 ease-in-out shadow-sm"
                  >
                    +
                  </button>
                  <button
                    onClick={() => openEditModal(windowType)}
                    className="ml-8 bg-blue-500 text-white w-10 h-10 rounded-full flex items-center justify-center text-xl hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-400 transition duration-200 ease-in-out shadow-sm"
                    title="Edit Window Type"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                      <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.38-2.828-2.828z" />
                    </svg>
                  </button>
                  <button
                    onClick={() => deleteWindowType(windowType.id)}
                    className="ml-2 bg-gray-300 text-gray-700 w-10 h-10 rounded-full flex items-center justify-center text-xl hover:bg-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-400 transition duration-200 ease-in-out shadow-sm"
                    title="Delete Window Type"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm6 0a1 1 0 11-2 0v6a1 1 0 112 0V8z" clipRule="evenodd" />
                    </svg>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Total Cost Section */}
        <div className="mt-8 pt-6 border-t-2 border-gray-200 flex justify-between items-center">
          <h2 className="text-3xl font-bold text-gray-800">Total Cost:</h2>
          <span className="text-4xl font-extrabold text-green-700">${totalCost.toFixed(2)}</span>
        </div>

        {/* Save/Load Quote Buttons */}
        <div className="mt-8 flex flex-col sm:flex-row justify-center gap-4">
          <button
            onClick={openSaveQuoteModal}
            className="bg-purple-600 text-white px-6 py-3 rounded-lg font-bold text-lg hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 transition duration-200 ease-in-out shadow-md"
          >
            Save Current Quote
          </button>
          <button
            onClick={fetchSavedQuotes}
            className="bg-teal-600 text-white px-6 py-3 rounded-lg font-bold text-lg hover:bg-teal-700 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:ring-offset-2 transition duration-200 ease-in-out shadow-md"
          >
            View Saved Quotes
          </button>
        </div>

      </div>

      {/* Custom Message Box */}
      {messageBox.isVisible && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-75 flex items-center justify-center z-50 p-4">
          <div className="bg-white p-6 rounded-lg shadow-xl max-w-sm w-full text-center">
            <p className="text-lg font-medium mb-6 text-gray-800">{messageBox.message}</p>
            <div className="flex justify-center space-x-4">
              {messageBox.onConfirm && (
                <button
                  onClick={messageBox.onConfirm}
                  className="bg-blue-600 text-white px-5 py-2 rounded-lg font-semibold hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 transition duration-200"
                >
                  Confirm
                </button>
              )}
              {messageBox.onCancel && (
                <button
                  onClick={messageBox.onCancel}
                  className="bg-gray-300 text-gray-800 px-5 py-2 rounded-lg font-semibold hover:bg-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-400 transition duration-200"
                >
                  Cancel
                </button>
              )}
              {!messageBox.onConfirm && !messageBox.onCancel && (
                <button
                  onClick={hideMessageBox}
                  className="bg-blue-600 text-white px-5 py-2 rounded-lg font-semibold hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 transition duration-200"
                >
                  OK
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Edit Window Modal */}
      {isEditModalOpen && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-75 flex items-center justify-center z-50 p-4">
          <div className="bg-white p-8 rounded-xl shadow-2xl w-full max-w-md">
            <h2 className="text-2xl font-semibold text-gray-800 mb-6 text-center">Edit Window Type</h2>
            <div className="space-y-4">
              <div>
                <label htmlFor="editWindowName" className="block text-gray-700 text-sm font-bold mb-2">
                  Window Name:
                </label>
                <input
                  type="text"
                  id="editWindowName"
                  value={editingWindowName}
                  onChange={(e) => setEditingWindowName(e.target.value)}
                  className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-400 outline-none"
                />
              </div>
              <div>
                <label htmlFor="editWindowPrice" className="block text-gray-700 text-sm font-bold mb-2">
                  Price:
                </label>
                <input
                  type="number"
                  id="editWindowPrice"
                  value={editingWindowPrice}
                  onChange={(e) => setEditingWindowPrice(e.target.value)}
                  className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-400 outline-none"
                  step="0.01"
                />
              </div>
            </div>
            <div className="flex justify-end space-x-4 mt-8">
              <button
                onClick={cancelEdit}
                className="bg-gray-300 text-gray-800 px-6 py-3 rounded-lg font-semibold hover:bg-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-400 transition duration-200 ease-in-out shadow-md"
              >
                Cancel
              </button>
              <button
                onClick={saveEditedWindow}
                className="bg-blue-600 text-white px-6 py-3 rounded-lg font-bold hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 transition duration-200 ease-in-out shadow-md"
              >
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Save Quote Modal */}
      {isSaveModalOpen && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-75 flex items-center justify-center z-50 p-4">
          <div className="bg-white p-8 rounded-xl shadow-2xl w-full max-w-md">
            <h2 className="text-2xl font-semibold text-gray-800 mb-6 text-center">Save Current Quote</h2>
            <div className="space-y-4">
              <div>
                <label htmlFor="quoteNameInput" className="block text-gray-700 text-sm font-bold mb-2">
                  Quote Name:
                </label>
                <input
                  type="text"
                  id="quoteNameInput"
                  value={quoteNameToSave}
                  onChange={(e) => setQuoteNameToSave(e.target.value)}
                  className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-400 outline-none"
                  placeholder="e.g., John Doe"
                />
              </div>
            </div>
            <div className="flex justify-end space-x-4 mt-8">
              <button
                onClick={() => setIsSaveModalOpen(false)}
                className="bg-gray-300 text-gray-800 px-6 py-3 rounded-lg font-semibold hover:bg-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-400 transition duration-200 ease-in-out shadow-md"
              >
                Cancel
              </button>
              <button
                onClick={saveCurrentQuote}
                disabled={isSavingQuote}
                className="bg-purple-600 text-white px-6 py-3 rounded-lg font-bold hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-purple-500 transition duration-200 ease-in-out shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSavingQuote ? 'Saving...' : 'Save Quote'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* View Saved Quotes Modal */}
      {isViewQuotesModalOpen && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-75 flex items-center justify-center z-50 p-4">
          <div className="bg-white p-8 rounded-xl shadow-2xl w-full max-w-3xl max-h-[80vh] overflow-y-auto">
            <h2 className="text-2xl font-semibold text-gray-800 mb-6 text-center">Saved Quotes</h2>
            {isLoadingQuotes ? (
              <p className="text-center text-gray-600 text-lg py-8">Loading quotes...</p>
            ) : savedQuotes.length === 0 ? (
              <p className="text-center text-gray-600 text-lg py-8">No quotes saved yet.</p>
            ) : (
              <div className="space-y-4">
                {savedQuotes.map((quote) => (
                  <div key={quote.id} className="flex flex-col sm:flex-row items-center justify-between bg-gray-50 p-4 rounded-lg shadow-sm border border-gray-200">
                    <div className="flex-1 text-center sm:text-left mb-2 sm:mb-0">
                      <h3 className="text-xl font-semibold text-gray-800">{quote.name}</h3>
                      <p className="text-gray-600 text-sm">
                        Saved: {quote.timestamp ? new Date(quote.timestamp.toDate()).toLocaleString() : 'N/A'}
                      </p>
                      <p className="text-gray-600 text-sm">
                        Total Cost: ${quote.totalCost ? quote.totalCost.toFixed(2) : '0.00'}
                      </p>
                    </div>
                    <div className="flex items-center space-x-3 mt-4 sm:mt-0">
                      <button
                        onClick={() => loadSelectedQuote(quote)}
                        className="bg-blue-500 text-white px-4 py-2 rounded-lg font-semibold hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-400 transition duration-200 ease-in-out shadow-md"
                      >
                        Load
                      </button>
                      <button
                        onClick={() => deleteSavedQuote(quote.id)}
                        className="bg-red-500 text-white px-4 py-2 rounded-lg font-semibold hover:bg-red-600 focus:outline-none focus:ring-2 focus:ring-red-400 transition duration-200 ease-in-out shadow-md"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
            <div className="flex justify-center mt-8">
              <button
                onClick={() => setIsViewQuotesModalOpen(false)}
                className="bg-gray-300 text-gray-800 px-6 py-3 rounded-lg font-semibold hover:bg-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-400 transition duration-200 ease-in-out shadow-md"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
