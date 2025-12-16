// --- 1. INITIALIZATION ---
// PASTE THE FIREBASE CONFIGURATION OBJECT YOU COPIED EARLIER HERE
  const firebaseConfig = {
    apiKey: "AIzaSyBwEf91Cf0m13JX0uIipIO1GwAOFR1tFD8",
    authDomain: "our-grocery-app.firebaseapp.com",
    projectId: "our-grocery-app",
    storageBucket: "our-grocery-app.firebasestorage.app",
    messagingSenderId: "885212081182",
    appId: "1:885212081182:web:525e03a5d9ba7613be520f"
  };
  
  // Initialize Firebase
  firebase.initializeApp(firebaseConfig);
  const auth = firebase.auth();
  const db = firebase.firestore();
  
  // --- 2. GET HTML ELEMENTS ---
  const loginButton = document.getElementById('login-button');
  const logoutButton = document.getElementById('logout-button');
  const userNameSpan = document.getElementById('user-name');
  const body = document.body;
  const itemInput = document.getElementById('item-input');
  const addButton = document.getElementById('add-button');
  const shoppingListUl = document.getElementById('shopping-list-ul');
  const completedListUl = document.getElementById('completed-list-ul');
  
  // --- 3. AUTHENTICATION LOGIC ---
  const signIn = () => auth.signInWithPopup(new firebase.auth.GoogleAuthProvider());
  const signOut = () => auth.signOut();
  
  loginButton.addEventListener('click', signIn);
  logoutButton.addEventListener('click', signOut);
  
  let unsubscribeFromList; // This will hold our real-time listener
  
  auth.onAuthStateChanged(user => {
        if (user) {
            // User has successfully signed in with Google.
            // NOW, we check if they are on our whitelist.
            const userDocRef = db.collection('allowedUsers').doc(user.uid);

            userDocRef.get().then((doc) => {
                if (doc.exists) {
                    // --- USER IS AUTHORIZED ---
                    console.log("User is authorized:", user.displayName);
                    document.body.classList.add('logged-in');
                    userNameSpan.textContent = user.displayName;

                    // Connect to the shared list and set up listeners...
                    const listCollection = db.collection('shared-lists').doc('our-family-list').collection('items');
                    
                    const addItem = () => {
                        const itemName = itemInput.value.trim();
                        if (itemName) {
                            listCollection.add({
                                name: itemName,
                                completed: false,
                                createdAt: firebase.firestore.FieldValue.serverTimestamp()
                            });
                            itemInput.value = '';
                        }
                    };
                    addButton.onclick = addItem;
                    itemInput.onkeyup = (event) => { if (event.key === 'Enter') addItem(); };
                    
                    unsubscribeFromList = listCollection.orderBy('createdAt').onSnapshot(snapshot => {
                        // ... same rendering logic as before ...
                        shoppingListUl.innerHTML = '';
                        completedListUl.innerHTML = '';
                        snapshot.docs.forEach(doc => {
                            const item = doc.data();
                            const id = doc.id;
                            const li = document.createElement('li');
                            li.innerHTML = `<input type="checkbox" id="${id}" ${item.completed ? 'checked' : ''}><label for="${id}">${item.name}</label>`;
                            
                            if (item.completed) {
                                completedListUl.appendChild(li);
                            } else {
                                shoppingListUl.appendChild(li);
                            }
            
                            const checkbox = li.querySelector('input[type="checkbox"]');
                            checkbox.addEventListener('change', () => {
                                listCollection.doc(id).update({ completed: checkbox.checked });
                            });
                        });
                    });

                } else {
                    // --- USER IS NOT AUTHORIZED ---
                    console.warn("Unauthorized user tried to log in:", user.displayName, user.uid);
                    // Show the unauthorized message and hide everything else.
                    document.getElementById('login-section').style.display = 'none';
                    document.getElementById('app-content').style.display = 'none';
                    document.getElementById('unauthorized-section').style.display = 'block';

                    // Make the new logout button work
                    document.getElementById('unauthorized-logout-button').onclick = () => auth.signOut();
                }
            }).catch((error) => {
                console.error("Error checking user authorization:", error);
                auth.signOut(); // Log them out if there's an error
            });

        } else {
            // --- USER IS LOGGED OUT ---
            console.log("User is logged out.");
            document.body.classList.remove('logged-in');
            
            // Reset all views to the initial state
            document.getElementById('login-section').style.display = 'block';
            document.getElementById('app-content').style.display = 'none';
            document.getElementById('unauthorized-section').style.display = 'none';

            if (unsubscribeFromList) unsubscribeFromList(); // Stop listening to Firestore
        }
    });