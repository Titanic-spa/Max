// Import necessary librarie
const { Telegraf } = require('telegraf');
const admin = require('firebase-admin');


// Initialize bot with your Telegram token
const bot = new Telegraf(process.env['BOT_API']); // Make sure to set your environment variable
let withdrawalsPaused = false;
// Initialize Firebase Admin SDK with your service account file
const serviceAccount = require('./CryptMax.json');

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    databaseURL: "https://crptmax-e1543.firebaseio.com"
});

// Initialize Firestore
const db = admin.firestore();

// Function to get user data from Firestore
async function getUserData(userId) {
    const userRef = db.collection('users').doc(userId);
    const doc = await userRef.get();
    if (!doc.exists) {
        return null; // User does not exist
    }
    return doc.data(); // Return user data
}

// Function to update user data in Firestore
async function setUserData(userId, data) {
    const userRef = db.collection('users').doc(userId);
    await userRef.set(data, { merge: true });
}
// Helper function to get user data
async function getUserData(userId) {
    const userDoc = await db.collection('users').doc(userId).get();
    return userDoc.exists ? userDoc.data() : null;
}

// Helper function to update user balance
async function updateUserBalance(userId, newBalance) {
    await db.collection('users').doc(userId).update({ balance: newBalance });
}

// Helper function to register a new user
async function registerNewUser(userId, data) {
    await db.collection('users').doc(userId).set(data);
}
// Helper function to count invited friends
async function countInvitedFriends(referrerId) {
    const invitedSnapshot = await db.collection('users').where('referrer', '==', referrerId).get();
    return invitedSnapshot.size; // Return count of invited friends
}
// Handle /me command for admin
bot.command('me',async (ctx) => {
    const userId = ctx.from.id.toString();
    const userData = await getUserData(userId);

    // Check if the user is the admin
    if (userId === '6478320664') { // Replace with your actual admin chat ID
        ctx.reply("📋 *Admin Panel* 📋\n\n Welcome, Admin\nUse the buttons below to manage users, tasks, and announcements etc. Ensure to maintain a smooth experience for all users.\n\nSelect an option to proceed:", {
            reply_markup: {
                inline_keyboard: [
                    [{ text: '⤴️Upload tasks', callback_data: 'tasks_upload' }],
                    [{ text: '🕵️View/Delete Tasks', callback_data: 'tasks_uploaded' }],
                    [{ text: '🚻Users/Edit/Delete', callback_data: 'log_users' }],
                    [{ text: '✋Pause & Play 🤖', callback_data: 'pause' }],
                    [{ text: '📢Announcements', callback_data: 'make_announcement' }] // New Announcements button
                ]
            }
        });
    } else {
        ctx.reply("❌🚫You are not authorized to use this command❌🙅.");
    }
});
// Temporary object to store message IDs for each user to delete later
const reverse = {};

// Handle the start command and show the main menu
bot.start(async (ctx) => {
    const userId = ctx.from.id.toString();
    const args = ctx.message.text.split(" ");
    let referrerId = args[1] ? args[1] : null;

    // Get user data
    const userData = await getUserData(userId);

    if (userData && userData.paymentStatus === 'Registered') {
        // Registered user, show the main menu
        const mainMenuMessage = await ctx.reply("Welcome back!👋 Here you are open to many possibilities🌟.\nYou not only earn straight from the bot, but you also get updated on other ways to earn on Telegram and other places😯.\n\nBe sure to join our channel🤗: https://t.me/cryptomax05\n\nAnd chat group👉: https://t.me/CryptoMAXDiscusson", {
            reply_markup: {
                inline_keyboard: [
                    [{ text: '🏦Balance', callback_data: 'balance' }],
                    [{ text: '👷Tasks', callback_data: 'tasks' }],
                    [{ text: '💁Support', callback_data: 'support' }],
                    [{ text: '💑Friends', callback_data: 'friends' }],
                    [{ text: '🔄Withdrawal', callback_data: 'withdrawal' }],
                    [{ text: '📈Top Earners', callback_data: 'top_earners' }],
                    [{ text: '🎉Claim', callback_data: 'claim' }]
                ]
            }
        });

        // Store the main menu message ID for deleting later for this user
        reverse[userId] = { mainMenuMessageId: mainMenuMessage.message_id };
    } else {
        // New or unregistered user
        if (referrerId && !userData) {
            await registerNewUser(userId, { referrer: referrerId, paymentStatus: 'Unregistered', balance: 0 });
        } else if (!userData) {
            await registerNewUser(userId, { paymentStatus: 'Unregistered', balance: 0 });
        }

        // Prompt user to complete registration
        ctx.reply("🌝Here's a bot that not only gives cash for simple tasks performed but also gives crypto and crypto updates.\n👇Click to Continue", {
            reply_markup: {
                inline_keyboard: [[{ text: 'Continue', callback_data: 'continue' }]]
            }
        });
    }
});

// Handle balance request
bot.action('balance', async (ctx) => {
    const userId = ctx.from.id.toString();
    const userData = await getUserData(userId);

    let responseMessage;

    if (userData && userData.paymentStatus === 'Registered') {
        const userPoints = userData.balance || 0;
        responseMessage = `🌟Your Total Points is ${userPoints} Points⛷️.`;
    } else {
        responseMessage = "❌You need to be registered to check your balance🚫.";
    }

    // delete the main menu message if it exists for this user
    if (reverse[userId] && reverse[userId].mainMenuMessageId) {
        await ctx.deleteMessage(reverse[userId].mainMenuMessageId);
    }

    // Send the balance message
    const balanceMessage = await ctx.reply(responseMessage, {
        reply_markup: {
            inline_keyboard: [
                [{ text: '⬅️ Back to Menu', callback_data: 'back_to_menu' }]
            ]
        }
    });

    // Store the balance message ID for this user
    reverse[userId].balanceMessageId = balanceMessage.message_id;
});

// Handle back to menu request
bot.action('back_to_menu', async (ctx) => {
    const userId = ctx.from.id.toString();

    // Delete the balance message if it exists for this user
    if (reverse[userId] && reverse[userId].balanceMessageId) {
        await ctx.deleteMessage(reverse[userId].balanceMessageId);
    }
    
    // Delete the previous referral message if it exists for this user
 else if (reverse[userId] && reverse[userId].referralMessageId) {
        await ctx.deleteMessage(reverse[userId].referralMessageId);
    }
    // Re-send the main menu
    const userData = await getUserData(userId);

    if (userData && userData.paymentStatus === 'Registered') {
        const mainMenuMessage = await ctx.reply("Welcome back!👋 Here you are open to many possibilities🌟.\nYou not only earn straight from the bot, but you also get updated on other ways to earn on Telegram and other places😯.\n\nBe sure to join our channel🤗: https://t.me/cryptomax05\n\nAnd chat group👉: https://t.me/CryptoMAXDiscusson", {
            reply_markup: {
                inline_keyboard: [
                    [{ text: '🏦Balance', callback_data: 'balance' }],
                    [{ text: '👷Tasks', callback_data: 'tasks' }],
                    [{ text: '💁Support', callback_data: 'support' }],
                    [{ text: '💑Friends', callback_data: 'friends' }],
                    [{ text: '🔄Withdrawal', callback_data: 'withdrawal' }],
                    [{ text: '📈Top Earners', callback_data: 'top_earners' }],
                    [{ text: '🎉Claim', callback_data: 'claim' }]
                ]
            }
        });
console.log("User ID:", userId);
console.log("reverse[userId] before setting:", reverse[userId]);

if (!reverse[userId]) {
  reverse[userId] = {};
}

reverse[userId].mainMenuMessageId = mainMenuMessage.message_id;

console.log("reverse[userId] after setting:", reverse[userId]);
    }
});
 // Handle "make_announcement" button press
bot.action('make_announcement', async (ctx) => {
    const userId = ctx.from.id.toString();
    if (userId === '6478320664') { // Confirm it's the admin
        // Set admin's expecting status to "announcement"
        const adminData = await getUserData(userId);
        adminData.expecting = 'announcement';
        await setUserData(userId, adminData);

        ctx.reply("Please type the announcement message you'd like to send to all users:");
    }
});
// Friends button to show referral link and invited friends count
bot.action('friends', async (ctx) => {
    const userId = ctx.from.id.toString();
    const userData = await getUserData(userId);

    // Generate referral link
    const referralLink = `https://t.me/Cryptomax1101Bot?start=${userId}`;

    // Delete the main menu message if it exists for this user
    if (reverse[userId] && reverse[userId].mainMenuMessageId) {
        await ctx.deleteMessage(reverse[userId].mainMenuMessageId);
    }

    // Get invited friends count
    const invitedFriendsCount = await countInvitedFriends(userId);

    // Prepare the referral message
    const responseMessage = `📢Earn 150 points from each friend invited.\nShare your referral link:\n🖇️ ${referralLink}\n\n👥 Friends Invited: ${invitedFriendsCount}`;

    // Send the referral message with a 'Back to Menu' button
    const referralMessage = await ctx.reply(responseMessage, {
        reply_markup: {
            inline_keyboard: [
                [{ text: '⬅️ Back to Menu', callback_data: 'back_to_menu' }]
            ]
        }
    });

    // Store the referral message ID for this user
    if (!reverse[userId]) {
        reverse[userId] = {};
    }
    reverse[userId].referralMessageId = referralMessage.message_id;
});

// Handle support command
bot.action('support', (ctx) => {
    const supportMessage = "*🚀 If you would like your very own task to be posted, then contact this number:* \n\n" +
        "`2349013586984`\n\n" +
        "_Do not contact this number for any other reason or else you will be blocked._";
    
    ctx.reply(supportMessage, {
        parse_mode: "Markdown"
    }).then((sentMessage) => {
        setTimeout(() => {
            ctx.deleteMessage(sentMessage.message_id);
        }, 10000); // Deletes message after 5 seconds
    });
});
// Top earners definition
bot.action('top_earners', async (ctx) => {
    const usersSnapshot = await db.collection('users').where('paymentStatus', '==', 'Registered').get();

    const topEarners = usersSnapshot.docs
        .map(doc => ({ name: doc.data().name, balance: doc.data().balance }))
        .sort((a, b) => b.balance - a.balance)
        .slice(0, 10)
        .map((user, index) => {
            const rankIcon = ["🥇", "🥈", "🥉"][index] || "🔹"; // Top 3 with medals, others with dots
            return `${rankIcon} *${user.name}* — \`${user.balance} points\` 🌿`;
        });

    const responseMessage = topEarners.length > 0
        ? "*🪧 Top 10 Earners 📢:*\n\n" + topEarners.join('\n')
        : "📛 *No registered users found.*";

    // Send the message with Markdown formatting
    const sentMessage = await ctx.reply(responseMessage, { parse_mode: "Markdown" });

    // Set a timeout to delete the message after 10 seconds (10000 milliseconds)
    setTimeout(() => {
        ctx.deleteMessage(sentMessage.message_id);
    }, 10000); // 10 seconds in milliseconds
});

// Store last message ID in this session-like object for withdrawal actions
const session = {};



// Handle Pause Withdrawals button action
bot.action('pause', (ctx) => {
    // Toggle the pause state
    withdrawalsPaused = !withdrawalsPaused;

    // Notify admin of the current state
    const statusMessage = withdrawalsPaused 
        ? "🚫 Withdrawals have been paused. All users are now unable to withdraw."
        : "✅ Withdrawals are now enabled. Users can proceed with withdrawals.";
    
    ctx.answerCbQuery(); // Close the button loading state
    ctx.reply(statusMessage);
});

// Handle withdrawal action for users
bot.action('withdrawal', async (ctx) => {
    if (withdrawalsPaused) {
        // Notify user that withdrawals are paused
return ctx.reply(
    "⚠️ Withdrawal Unavailable Right Now ⚠️\n\n" +
    "🔄 Please hang tight! Withdrawals are temporarily inaccessible. This may be due to maintenance or high demand. " +
    "We're working hard to bring this feature back as soon as possible.\n\n" +
    "💡 Stay updated by checking our official channel for the latest announcements and info. ⭐\n\n" +
    "Thank you for your patience and understanding! 🙏"
);
    }

    // If withdrawals are not paused, proceed with withdrawal options
    const sentMessage = await ctx.reply("Choose your withdrawal option:", {
        reply_markup: {
            inline_keyboard: [
                [{ text: '🏦Bank Transfer', callback_data: 'bank_transfer' }],
                [{ text: '💲Crypto', callback_data: 'crypto' }]
            ]
        }
    });
    
    // Store the message ID in the session for later deletion (if necessary)
    session[ctx.from.id] = sentMessage.message_id;
});

// Additional logic for handling bank and crypto withdrawal options...
bot.action('bank_transfer', async (ctx) => {
    const userId = ctx.from.id.toString();
    const userData = await getUserData(userId);
    await setUserData(userId, { expecting: 'bank_details' });

    // Delete the initial withdrawal message
    if (session[userId]) {
        await ctx.deleteMessage(session[userId]);
        delete session[userId]; // Remove message ID from session
    }

    // Check if bank details already exist
    if (userData.bankDetails) {
        // Skip asking for bank details, go directly to package selection
        await handleBankPackageSelection(ctx, userId);
    } else {
        // Ask for bank details
        ctx.reply("Please provide your bank details in this format:\nName: (your account name)\nAccount Number: (your account number)\nBank Name: (your bank name)");
    }
});

// Handle 'crypto' option
bot.action('crypto', async (ctx) => {
    const userId = ctx.from.id.toString();
    const userData = await getUserData(userId);
    await setUserData(userId, { expecting: 'usdt_address' });

    // Delete the initial withdrawal message
    if (session[userId]) {
        await ctx.deleteMessage(session[userId]);
        delete session[userId]; // Remove message ID from session
    }

    // Check if USDT address already exists
    if (userData.usdtAddress) {
        // Skip asking for USDT address, go directly to package selection
        await handleCryptoPackageSelection(ctx, userId);
    } else {
        // Ask for USDT address
        ctx.reply("Please provide your USDT (TON) address:");
    }
});

// Handle bank package selection
async function handleBankPackageSelection(ctx, userId) {
    ctx.reply("Choose withdrawal package 📦:", {
        reply_markup: {
            inline_keyboard: [
                [{ text: '5,000 Points - 5,000 Naira', callback_data: `bank_package_5000_${userId}` }],
                [{ text: '10,000 Points - 10,000 Naira', callback_data: `bank_package_10000_${userId}` }],
                [{ text: '15,000 Points - 15,000 Naira', callback_data: `bank_package_15000_${userId}` }]
            ]
        }
    });
}

// Handle crypto package selection
async function handleCryptoPackageSelection(ctx, userId) {
    ctx.reply("Choose withdrawal package 📦:", {
        reply_markup: {
            inline_keyboard: [
                [{ text: '5,000 Points - 2.5 USDT', callback_data: `crypto_package_2.5_${userId}` }],
                [{ text: '10,000 Points - 5 USDT', callback_data: `crypto_package_5_${userId}` }],
                [{ text: '15,000 Points - 7.5 USDT', callback_data: `crypto_package_7.5_${userId}` }]
            ]
        }
    });
}
// Handle bank package selection callback
bot.action(/bank_package_(\d+)_(\d+)/, async (ctx) => {
    const userId = ctx.match[2];
    const packageAmount = ctx.match[1];

    const userData = await getUserData(userId);

    if (userData.balance >= packageAmount) {
        userData.balance -= packageAmount;
        await setUserData(userId, userData);

        // Send request to admin
        const adminMessage = `Withdrawal request:\nUsername: ${userData.name}\nBank Details: ${userData.bankDetails}\nPackage: ${packageAmount} Naira`;
        ctx.telegram.sendMessage('6478320664', adminMessage, {
            reply_markup: {
                inline_keyboard: [
                    [{ text: 'Accept', callback_data: `accept_withdrawal_${userId}` }],
                    [{ text: 'Decline', callback_data: `decline_withdrawal_${userId}` }]
                ]
            }
        });
        ctx.reply("✅ Your withdrawal request has been sent for approval.");
    } else {
        ctx.reply("❌ You don't have enough points to make this withdrawal.");
    }
});

// Handle crypto package selection callback
bot.action(/crypto_package_(\d+)_(\d+)/, async (ctx) => {
    const userId = ctx.match[2];
    const packageAmount = ctx.match[1];

    const userData = await getUserData(userId);

    if (userData.balance >= packageAmount) {
        userData.balance -= packageAmount;
        await setUserData(userId, userData);

        // Send request to admin
        const adminMessage = `Withdrawal request:\nUsername: ${userData.name}\nUSDT Address: ${userData.usdtAddress}\nPackage: ${packageAmount} USDT`;

ctx.telegram.sendMessage('6478320664', adminMessage, {
            reply_markup: {
                inline_keyboard: [
                    [{ text: 'Accept', callback_data: `accept_withdrawal_${userId}` }],
                    [{ text: 'Decline', callback_data: `decline_withdrawal_${userId}` }]
                ]
            }
        });
        ctx.reply("✅ Your withdrawal request has been sent for approval.");
    } else {
        ctx.reply("❌ You don't have enough points to make this withdrawal.");
    }
});
// Handle admin accept for withdrawal
bot.action(/accept_withdrawal_(\d+)/, async (ctx) => {
    const userId = ctx.match[1];

    // Update user's balance or status
    await setUserData(userId, { withdrawalStatus: 'Accepted' });

    // Notify the user
    const userData = await getUserData(userId);
    ctx.telegram.sendMessage(userId, `💵Your withdrawal request has been accepted and your balance has been updated. The funds will be sent to your account shortly.`);

    // Delete the message after the admin accepts the withdrawal
    await ctx.deleteMessage(); 
});

// Handle admin decline for withdrawal
bot.action(/decline_withdrawal_(\d+)/, async (ctx) => {
    const userId = ctx.match[1];

    // Notify the user that the withdrawal was declined
    await setUserData(userId, { withdrawalStatus: 'Declined' });
    ctx.telegram.sendMessage(userId, `❌Your withdrawal request has been declined. Please contact support for assistance.`);

    // Delete the message after the admin declines the withdrawal
    await ctx.deleteMessage();
});
// Handle claim request
bot.action('claim', async (ctx) => {
    const userId = ctx.from.id.toString();
    const currentTime = Date.now();
    const claimAmount = 50; // Points to claim

    const userData = await getUserData(userId);

    let responseMessage;

    if (userData && userData.paymentStatus === 'Registered') {
        // Check if 24 hours have passed since the last claim
        if (!userData.lastClaim || (currentTime - userData.lastClaim) >= 24 * 60 * 60 * 1000) {
            userData.balance = (userData.balance || 0) + claimAmount;
            userData.lastClaim = currentTime;

            await setUserData(userId, userData);

            responseMessage = `🎉 *Claim Successful!* 🎉\n\n` +
                `You've earned *${claimAmount} points* 💎!\n` +
                `*New Balance:* \`${userData.balance} points\` 🎈`;
        } else {
            const remainingTime = 24 * 60 * 60 * 1000 - (currentTime - userData.lastClaim);
            const remainingHours = Math.floor((remainingTime / (1000 * 60 * 60)) % 24);
            const remainingMinutes = Math.floor((remainingTime / (1000 * 60)) % 60);

            responseMessage = `🦥 *Claim Unavailable* 🦥\n\n` +
                `Please wait *${remainingHours} hours* and *${remainingMinutes} minutes* before claiming again 🔻.`;
        }
    } else {
        responseMessage = "📛 *Registration Required* 📛\n\n" +
            "You need to be registered to claim points.";
    }

    // Send the message with Markdown formatting
    const sentMessage = await ctx.reply(responseMessage, { parse_mode: "Markdown" });

    // Set a timeout to delete the message after 10 seconds
    setTimeout(() => {
        ctx.deleteMessage(sentMessage.message_id);
    }, 10000); // 10 seconds in milliseconds
});

// Handle continue action
bot.action('continue', (ctx) => {
    ctx.reply(
        "*🌝To continue with this bot, a payment of 3,000 Naira or 2 USDT has to be made.*\n\n" +
        "*Make payment to this receiving information to continue🔄:*\n\n" +
        "*Bank Transfer*\n" +
        "Bank: `KUDA`\n" +
        "Account Number: `2040597025`\n" +
        "Account Name: `IGBAYO MAXWELL OGHENERO`\n\n" +
        "*USDT (TRC-20)*\n" +
        "Wallet Address: `TKTVFw1HXE7n84497whER6qct9AhFm6PyZ`\n\n" +
        "*USDT Ton*\n" +
        "Wallet Address: `UQB73bE2wn9JZWAOsPkqx8JhiFarSonAFkIpFOTI4LG_njgK`\n\n" +
        "👇 Click *Continue* when done!",
        {
            parse_mode: "Markdown",
            reply_markup: {
                inline_keyboard: [[{ text: 'Continue', callback_data: 'payment_done' }]]
            }
        }
    );
});

// Handle payment_done action
bot.action('payment_done', (ctx) => {
    ctx.reply("🖼️Submit the screenshot of payment.");
});
// Modify the photo handler to set a flag when asking for the transaction hash or name
bot.on('photo', async (ctx) => {
    const photoId = ctx.message.photo[ctx.message.photo.length - 1].file_id;
    const userId = ctx.from.id.toString();

    await setUserData(userId, {
        photoId,
        name: ctx.from.first_name,
        paymentStatus: 'Pending',
        balance: 150,
        expecting: 'transaction_hash' // Set flag to indicate we are expecting a transaction hash or name next
    });

    ctx.reply("📝Submit your Bank Name or Transaction Hash if it was Usdt you sent.");
});


// Separate functions to modularize the code and improve readability

// Function to handle transaction hash submission
async function handleTransactionHash(ctx, userId, userData) {
    userData.tnxHash = ctx.message.text;
    userData.expecting = null;
    await setUserData(userId, userData);

    const adminMessage = `Subscription request:\nUser's Name: ${userData.name}\nUser's Transaction Hash or Name: ${ctx.message.text}`;
    const sentMessage = await ctx.telegram.sendPhoto('6478320664', userData.photoId, {
        caption: adminMessage,
        reply_markup: {
            inline_keyboard: [
                [{ text: 'Accept', callback_data: 'accept_' + userId }],
                [{ text: 'Decline', callback_data: 'decline_' + userId }]
            ]
        }
    });

    ctx.reply("🌟Your payment proof and transaction information have been submitted for approval🚀\n\nYour request is being processed; please be patient 🚀.");
    return sentMessage;
}

// Function to handle bank details submission
async function handleBankDetails(ctx, userId, userData) {
    userData.bankDetails = ctx.message.text;
    userData.expecting = null;
    await setUserData(userId, userData);
    await handleBankPackageSelection(ctx, userId);
}

// Function to handle USDT address submission
async function handleUSDTAddress(ctx, userId, userData) {
    userData.usdtAddress = ctx.message.text;
    userData.expecting = null;
    await setUserData(userId, userData);
    await handleCryptoPackageSelection(ctx, userId);
}

// Function to handle admin accept action
async function handleAdminAccept(ctx, userId) {
    await setUserData(userId, { paymentStatus: 'Registered' });

    const userData = await getUserData(userId);
    if (userData.referrer) {
        const referrerData = await getUserData(userData.referrer);
        const updatedBalance = (referrerData.balance || 0) + 150;
        await updateUserBalance(userData.referrer, updatedBalance);

        await ctx.telegram.sendMessage(userData.referrer, "🎉 Your friend has completed registration! You earned 150 points!");
    }

    await ctx.telegram.sendMessage(userId, "💁Welcome! Your subscription has been confirmed🎉 ...", {
        reply_markup: {
            inline_keyboard: [
                [{ text: '🏦Balance', callback_data: 'balance' }],
                [{ text: '👷Tasks', callback_data: 'tasks' }],
                [{ text: '📝Support', callback_data: 'support' }],
                [{ text: '💑Friends', callback_data: 'friends' }],
                [{ text: '🔄Withdrawal', callback_data: 'withdrawal' }],
                [{ text: '📈Top Earners', callback_data: 'top_earners' }],
                [{ text: '🎉Claim', callback_data: 'claim' }]
            ]
        }
    });
}

// Function to handle admin decline action
async function handleAdminDecline(ctx, userId) {
    await setUserData(userId, { paymentStatus: 'Declined' });
    await ctx.telegram.sendMessage(userId, "😭😭Your payment has been declined. Please make sure to provide the correct details or contact support for assistance🥹.");
}

// Function to handle admin announcement
async function handleAdminAnnouncement(ctx, announcementMessage) {
    const usersSnapshot = await db.collection('users').get();
    await Promise.all(usersSnapshot.docs.map(async (doc) => {
        const userId = doc.id;
        try {
            await bot.telegram.sendMessage(userId, `📢 Announcement:\n\n${announcementMessage}`);
        } catch (error) {
            console.error(`Failed to send message to user ${userId}:`, error);
        }
    }));
    ctx.reply("✅ Announcement sent to all users.");
}

// Main text handler with switch-case to handle different user actions
bot.on('text', async (ctx) => {
    const userId = ctx.from.id.toString();
    const userData = await getUserData(userId);

    if (!userData) {
        ctx.reply("User data not found. Please register first.");
        return;
    }

    const currentStep = userData.expecting || (taskData[userId] && taskData[userId].step);

    switch (currentStep) {
        case 'transaction_hash':
            await handleTransactionHash(ctx, userId, userData);
            break;
        
        case 'bank_details':
            await handleBankDetails(ctx, userId, userData);
            break;

        case 'usdt_address':
            await handleUSDTAddress(ctx, userId, userData);
            break;

        case 'name':
            if (!taskData[userId]) taskData[userId] = {};
            taskData[userId].name = ctx.message.text;
            taskData[userId].step = 'description'; // Move to the next step
            ctx.reply(`Task name set to: ${ctx.message.text}\n\nPlease enter the task description:`);
            break;

        case 'description':
            taskData[userId].description = ctx.message.text;
            taskData[userId].step = 'points'; // Move to the next step
            ctx.reply(`Task description set to: ${ctx.message.text}\n\nPlease enter the task points:`);
            break;

        case 'points':
            const points = parseInt(ctx.message.text, 10);
            if (isNaN(points)) {
                ctx.reply("❌ Invalid input. Please enter a valid number for points.");
            } else {
                taskData[userId].points = points;
                delete taskData[userId].step; // Clear step to indicate task is complete
                ctx.reply(`Task points set to: ${points}\n\nTask setup is complete.`);
                // Save the task or process further if needed
            }
            break;

        default:
            // Handling admin actions
            if (userId === '6478320664') {
                const adminData = await getUserData(userId);
                
                if (adminData && adminData.expecting === 'balance') {
                    await editBalance(ctx);
                } else if (adminData && adminData.expecting === 'announcement') {
                    await handleAdminAnnouncement(ctx, ctx.message.text);
                    adminData.expecting = null;
                    await setUserData(userId, adminData);
                }
            } else {
                // General response for unrecognized messages
                ctx.reply("Sorry, I didn't understand that. Please follow the instructions or use a command.");
            }
            break;
    }
});

// Admin accept and decline actions
bot.action(/accept_(\d+)/, async (ctx) => {
    const userId = ctx.match[1];
    await handleAdminAccept(ctx, userId);
});

bot.action(/decline_(\d+)/, async (ctx) => {
    const userId = ctx.match[1];
    await handleAdminDecline(ctx, userId);
});

// Async function to handle balance editing by admin
async function editBalance(ctx) {
    const adminId = '6478320664';
    const userId = ctx.from.id.toString();

    if (userId === adminId) {
        const adminData = await getUserData(adminId);
        if (adminData && adminData.expecting === 'balance') {
            const targetUserId = adminData.targetUserId;
            const newBalance = parseFloat(ctx.message.text);

            if (!isNaN(newBalance)) {
                const targetUserData = await getUserData(targetUserId);

                if (targetUserData) {
                    targetUserData.balance = newBalance;
                    await setUserData(targetUserId, targetUserData);

                    ctx.reply(`✅ Balance for ${targetUserData.name} has been updated to ${newBalance} points.`);

                    adminData.expecting = null;
                    await setUserData(adminId, adminData);
                } else {
                    ctx.reply("❌ User not found.");
                }
            } else {
                ctx.reply("❌ Invalid input. Please enter a valid number.");
            }
        }
    } else {
        ctx.reply("❌ You are not authorized to edit a balance.");
    }
}

// Handle the callback for editing a user's balance (admin only)
bot.action(/edit_balance_(.+)/, async (ctx) => {
    const adminId = '6478320664';
    const userId = ctx.from.id.toString();

    if (userId === adminId) {
        const targetUserId = ctx.match[1];
        const targetUserData = await getUserData(targetUserId);

        if (targetUserData) {
            ctx.reply(`Please enter the new balance for ${targetUserData.name}:`);

            const adminData = await getUserData(adminId);
            adminData.expecting = 'balance';
            adminData.targetUserId = targetUserId;
            await setUserData(adminId, adminData);
        } else {
            ctx.reply("❌ User not found.");
        }
    } else {
        ctx.reply("❌ You are not authorized to edit a balance.");
    }
});
// Handle the log_users callback
bot.action('log_users', async (ctx) => {
    const userId = ctx.from.id.toString();

    // Check if the user is the admin
    if (userId === '6478320664') { // Replace with your actual admin chat ID
        const usersSnapshot = await db.collection('users').get();

        // Create a list of users
        const usersList = usersSnapshot.docs.map(doc => ({
            id: doc.id,
            name: doc.data().name || 'Unknown' // Provide a default value for name
        }));

        if (usersList.length > 0) {
            const userButtons = usersList.map(user => [{ text: user.name, callback_data: `view_user_${user.id}` }]);
            ctx.reply("📋 Here are the registered users:", {
                reply_markup: { inline_keyboard: userButtons }
            });
        } else {
            ctx.reply("📛 No users found.");
        }
    } else {
        ctx.reply("❌🚫 You are not authorized to use this command.");
    }
});

// Handle view user action
bot.action(/view_user_(.+)/, async (ctx) => {
    const userId = ctx.match[1];
    const userData = await getUserData(userId);

    if (userData) {
        const userInfo = `
            📝 User Information:
            Name: ${userData.name}
            Balance: ${userData.balance || 0}
            Payment Status: ${userData.paymentStatus}
            Bank Details: ${userData.bankDetails || 'N/A'}
            USDT Address: ${userData.usdtAddress || 'N/A'}
        `;
         ctx.reply(userInfo, {
            reply_markup: {
                inline_keyboard: [
                    [{ text: 'Edit Balance', callback_data: `edit_balance_${userId}` }],
                    [{ text: 'Delete User', callback_data: `delete_user_${userId}` }],
                                 [{ text: 'Send Message', callback_data: `send_message_${userId}` }]
                ]
            }
        });
    } else {
        ctx.reply("📛 User not found.");
    }
});
 // Update the user // Async function to handle balance editing by admin
async function editBalance(ctx) {
    const adminId = '6478320664'; // Admin ID (replace with actual admin ID)
    const userId = ctx.from.id.toString();

    // Check if the sender is the admin
    if (userId === adminId) {
        const adminData = await getUserData(adminId);

        // Check if the admin is in the 'expecting balance' state
        if (adminData && adminData.expecting === 'balance') {
            const targetUserId = adminData.targetUserId; // The user whose balance is being edited
            const newBalance = parseFloat(ctx.message.text); // Parse the entered balance

            if (!isNaN(newBalance)) {
                // If valid number, proceed to update the target user's balance
                const targetUserData = await getUserData(targetUserId); // Get target user data

                if (targetUserData) {
                    targetUserData.balance = newBalance; // Update the balance
                    await setUserData(targetUserId, targetUserData); // Save the updated data

                    // Notify the admin and confirm balance change
                    ctx.reply(`✅ Balance for ${targetUserData.name} has been updated to ${newBalance} points.`);

                    // Clear the 'expecting' status for the admin
                    adminData.expecting = null;
                    await setUserData(adminId, adminData); // Update admin data
                } else {
                    ctx.reply("❌ User not found.");
                }
            } else {
                ctx.reply("❌ Invalid input. Please enter a valid number.");
            }
        }
    } else {
        // If it's not the admin, show a rejection message
        ctx.reply("❌ You are not authorized to edit a balance.");
    }
}

// Handle the callback for editing a user's balance (admin only)
bot.action(/edit_balance_(.+)/, async (ctx) => {
    const adminId = '6478320664'; // Admin ID (replace with actual admin ID)
    const userId = ctx.from.id.toString();

    if (userId === adminId) { // Check if the user is the admin
        const targetUserId = ctx.match[1]; // Get the target user ID from the callback data

        const targetUserData = await getUserData(targetUserId);

        if (targetUserData) {
            // Notify the admin to input a new balance for the user
            ctx.reply(`Please enter the new balance for ${targetUserData.name}:`);

            // Mark the admin as "expecting balance" and store the target user's ID
            const adminData = await getUserData(adminId);
            adminData.expecting = 'balance'; // Set expecting status
            adminData.targetUserId = targetUserId; // Store the target user ID
            await setUserData(adminId, adminData); // Update the admin data
        } else {
            ctx.reply("❌ User not found.");
        }
    } else {
        ctx.reply("❌ You are not authorized to edit a balance.");
    }
});
// Handle delete user action
bot.action(/delete_user_(.+)/, async (ctx) => {
    const userId = ctx.match[1];

    // Confirm deletion
    ctx.reply("⚠️ Are you sure you want to delete this user? This action cannot be undone.", {
        reply_markup: {
            inline_keyboard: [
                [
                    { text: 'Yes', callback_data: `confirm_delete_${userId}` },
                    { text: 'No', callback_data: 'cancel_delete' }
                ]
            ]
        }
    });
});

// Handle confirmation of user deletion
bot.action(/confirm_delete_(.+)/, async (ctx) => {
    const userId = ctx.match[1];

    await db.collection('users').doc(userId).delete();
    ctx.reply("✅ User has been deleted successfully.");
});

// Handle cancellation of deletion
bot.action('cancel_delete', (ctx) => {
    ctx.reply("❌ User deletion has been canceled.");
});
// Handle 'task' action to show tasks
bot.action('tasks', async (ctx) => {
    const userId = ctx.from.id.toString();
    const tasksRef = db.collection('tasks');
    const snapshot = await tasksRef.get();

    if (snapshot.empty) {
        ctx.reply("📭 *No tasks available at the moment.*", { parse_mode: "Markdown" });
        return;
    }

    // Fetch user data to check completed tasks
    const userData = await getUserData(userId);
    const completedTasks = userData.completedTasks || [];

    // Filter out completed tasks from the task list
    const tasks = snapshot.docs
        .map(doc => ({ id: doc.id, ...doc.data() }))
        .filter(task => !completedTasks.includes(task.id)); // Filter tasks the user has completed

    if (tasks.length === 0) {
        ctx.reply("🎉 *Congratulations!* You have completed all available tasks!", { parse_mode: "Markdown" });
        return;
    }

    // Construct the task message for available (not completed) tasks
let taskMessage = "<b>Available Tasks:</b>\n\n";
tasks.forEach(task => {
    taskMessage += `📋 <b>Task:</b> ${task.name}\n` +
                   `📝 <b>Description:</b> <i>${task.description}</i>\n` +
                   `💰 <b>Points:</b> <code>${task.points}</code> points\n\n`;
});

taskMessage += "<b>Click on a task to complete it.</b>";

// Send task message with inline buttons for remaining tasks
ctx.reply(taskMessage, {
    parse_mode: "HTML",
    reply_markup: {
        inline_keyboard: tasks.map(task => [
            { text: `✅ Complete ${task.name}`, callback_data: `complete_task_${task.id}` }
        ])
    }
});
});
// Handle task completion
bot.action(/complete_task_(\w+)/, async (ctx) => {
    const taskId = ctx.match[1];
    const userId = ctx.from.id.toString();
    const taskRef = db.collection('tasks').doc(taskId);
    const taskDoc = await taskRef.get();

    if (!taskDoc.exists) {
        ctx.reply('❌ This task no longer exists.');
        return;
    }

    const taskData = taskDoc.data();
    const userData = await getUserData(userId);

    // Check if the task is already completed
    if (userData.completedTasks && userData.completedTasks.includes(taskId)) {
        ctx.reply('🌝You have already completed this task.');
        return;
    }

    // Delete the task list message immediately to prevent multiple clicks
    try {
        await ctx.deleteMessage(); // Deletes the task list message right away
    } catch (error) {
        console.log('Failed to delete message:', error);
    }

    // Add task to completed tasks
    userData.completedTasks = userData.completedTasks || [];
    userData.completedTasks.push(taskId);

    // Notify user of task completion and reward processing
    ctx.reply(`✅ Your task is processing make sure you completed👉 ${taskData.name}.\n Your reward is processing🔃`);

    // Delay of 10 seconds before rewarding
    setTimeout(async () => {
        // Update user balance and data
        userData.balance += taskData.points;
        await setUserData(userId, userData);

        ctx.reply(`💵 You've been rewarded with ${taskData.points} points! Your new balance is ${userData.balance} points.`);

        // Send updated task list
        await sendUpdatedTaskList(ctx, userId);
    }, 10000);
});
// Function to send the updated task list
async function sendUpdatedTaskList(ctx, userId) {
    const tasksRef = db.collection('tasks');
    const snapshot = await tasksRef.get();

    if (snapshot.empty) {
        ctx.reply('No tasks available at the moment.');
        return;
    }

    // Fetch user data to check completed tasks
    const userData = await getUserData(userId);
    const completedTasks = userData.completedTasks || [];

    // Filter out completed tasks
    const tasks = snapshot.docs
        .map(doc => ({ id: doc.id, ...doc.data() }))
        .filter(task => !completedTasks.includes(task.id)); // Filter tasks already completed by the user

    if (tasks.length === 0) {
        ctx.reply('🎉 You have completed all available tasks!');
        return;
    }

    // Construct task message for available (not completed) tasks
    let taskMessage = 'Updated Tasks:\n\n';
    tasks.forEach(task => {
        taskMessage += `📋 Task: ${task.name}\n📝 Description: ${task.description}\n💰 Points: ${task.points}\n\n`;
    });

    taskMessage += "Click on a task to complet  it.";

    // Send the updated task list with inline buttons
    ctx.reply(taskMessage, {
        reply_markup: {
            inline_keyboard: tasks.map(task => [{ text: `Complete ${task.name}`, callback_data: `complete_task_${task.id}` }])
        }
    });
}
// Action to upload tasks
bot.action('tasks_upload', async (ctx) => {
    const message = await ctx.reply("Let's start creating a new task. Please choose an option:", {
        reply_markup: {
            inline_keyboard: [
                [{ text: 'Enter Task Name', callback_data: 'enter_task_name' }],
                [{ text: 'Enter Task Description', callback_data: 'enter_task_description' }],
                [{ text: 'Set Task Points', callback_data: 'set_task_points' }],
                [{ text: 'Confirm Task', callback_data: 'confirm_task' }]
            ]
        }
    });

    // Set a timeout to delete the message after 1 minute (60000 milliseconds)
    setTimeout(() => {
        ctx.deleteMessage(message.message_id).catch(err => console.log('Could not delete message:', err));
    }, 60000);
});

// Store task creation data in memory
let taskData = {};

// Handle entering task name
bot.action('enter_task_name', async (ctx) => {
    taskData[ctx.from.id] = taskData[ctx.from.id] || {};
    taskData[ctx.from.id].step = 'name';
    ctx.reply("Please send me the task name:");
});

// Handle entering task description
bot.action('enter_task_description', async (ctx) => {
    taskData[ctx.from.id] = taskData[ctx.from.id] || {};
    taskData[ctx.from.id].step = 'description';
    ctx.reply("Please send me the task description:");
});

// Handle setting task points
bot.action('set_task_points', async (ctx) => {
    taskData[ctx.from.id] = taskData[ctx.from.id] || {};
    taskData[ctx.from.id].step = 'points';
    ctx.reply("Please send the points for this task:");
});

// Collect task details via user messages


// Confirm task creation
bot.action('confirm_task', async (ctx) => {
    const userId = ctx.from.id;
    const task = taskData[userId];

    if (task.name && task.description && task.points) {
        // Save the task in Firestore
        await db.collection('tasks').add({
            name: task.name,
            description: task.description,
            points: task.points
        });
          ctx.deleteMessage()
        ctx.reply(`✅ Task "${task.name}" created successfully!`);
    } else {
        ctx.reply("⚠️ You haven't completed all the task details. Please provide all the necessary information.");
    }
});
// Admin views and deletes tasks
bot.action('tasks_uploaded', async (ctx) => {
    const tasksRef = db.collection('tasks');
    const snapshot = await tasksRef.get();

    if (snapshot.empty) {
        ctx.reply('No tasks uploaded yet.');
        return;
    }

    const tasks = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    let taskMessage = 'Uploaded Tasks:\n\n';
    tasks.forEach(task => {
        taskMessage += `📋 Task: ${task.name}\n📝 Description: ${task.description}\n💰 Points: ${task.points}\n\n`;
    });

    taskMessage += "Click on a task to delete it.";

    ctx.reply(taskMessage, {
        reply_markup: {
            inline_keyboard: tasks.map(task => [{ text: `Delete ${task.name}`, callback_data: `delete_task_${task.id}` }])
        }
    });
});

// Handle task deletion by admin
bot.action(/delete_task_(\w+)/, async (ctx) => {
    const taskId = ctx.match[1];
    await db.collection('tasks').doc(taskId).delete();
    ctx.reply('❌ Task deleted successfully.');
});

// Start the bot
console.log(`on fire max⏩⏩`)
bot.launch();
