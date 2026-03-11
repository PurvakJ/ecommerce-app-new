function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);
    const action = data.action;

    initSheets();

    let result;
    switch (action) {
      case "signup":
        result = signup(data);
        break;
      case "login":
        result = login(data);
        break;
      case "updateProfile":
        result = updateProfile(data);
        break;

      case "getProducts":
        result = getProducts();
        break;
      case "addProduct":
        result = addProduct(data);
        break;
      case "updateProduct":
        result = updateProduct(data);
        break;
      case "deleteProduct":
        result = deleteProduct(data);
        break;

      case "checkout":
        result = checkout(data);
        break;
      case "getOrders":
        result = getOrders(data);
        break;
      case "getOrderDetails":
        result = getOrderDetails(data);
        break;
      case "updateOrderStatus":
        result = updateOrderStatus(data);
        break;

      default:
        result = { success: false, message: "Invalid action" };
    }

    return sendResponse(result);
  } catch (err) {
    return sendResponse({ success: false, error: err.toString() });
  }
}

/* ================= SHEET SETUP ================= */

function initSheets() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  createSheet(ss, "USERS", [
    "id",
    "email",
    "password",
    "role",
    "name",
    "address",
    "phone",
    "created_at"
  ]);

  createSheet(ss, "PRODUCTS", [
    "id",
    "name",
    "price",
    "description",
    "imageUrl",
    "size",        // Changed from "quantity" to "size"
    "category",
    "created_at"
  ]);

  // ONE ROW PER ORDER + JSON ITEMS
  createSheet(ss, "ORDERS", [
    "id",
    "email",
    "total",
    "status",
    "address",
    "phone",
    "name",
    "payment",
    "items_json",
    "created_at"
  ]);
}

function createSheet(ss, name, headers) {
  let sh = ss.getSheetByName(name);
  if (!sh) {
    sh = ss.insertSheet(name);
    sh.appendRow(headers);
  }
}

function getSheet(name) {
  return SpreadsheetApp.getActive().getSheetByName(name);
}

/* ================= AUTH ================= */

function signup(data) {
  const sh = getSheet("USERS");
  const rows = sh.getDataRange().getValues();

  if (rows.some((r, i) => i > 0 && r[1] === data.email))
    return { success: false, error: "User already exists" };

  sh.appendRow([
    genId(),
    data.email,
    data.password,
    "user",
    data.name || "",
    "",
    "",
    new Date().toISOString()
  ]);

  return { success: true };
}

function login(data) {
  const rows = getSheet("USERS").getDataRange().getValues();

  for (let i = 1; i < rows.length; i++) {
    if (rows[i][1] === data.email && rows[i][2] === data.password) {
      return {
        success: true,
        role: rows[i][3],
        name: rows[i][4],
        email: rows[i][1]
      };
    }
  }
  return { success: false };
}

function updateProfile(data) {
  const sh = getSheet("USERS");
  const rows = sh.getDataRange().getValues();

  for (let i = 1; i < rows.length; i++) {
    if (rows[i][1] === data.email) {
      sh.getRange(i + 1, 5, 1, 3).setValues([
        [data.name, data.address, data.phone]
      ]);
      return { success: true };
    }
  }
  return { success: false };
}

/* ================= PRODUCTS ================= */

function getProducts() {
  const rows = getSheet("PRODUCTS").getDataRange().getValues();
  return { success: true, data: rows.slice(1) };
}

function addProduct(data) {
  getSheet("PRODUCTS").appendRow([
    genId(),
    data.name,
    Number(data.price),
    data.description || "",
    data.imageUrl || "",
    data.size || "M",    // Changed from quantity to size (default "M")
    data.category || "General",
    new Date().toISOString()
  ]);
  return { success: true };
}

function updateProduct(data) {
  const sh = getSheet("PRODUCTS");
  const rows = sh.getDataRange().getValues();

  for (let i = 1; i < rows.length; i++) {
    if (rows[i][0] === data.id) {
      sh.getRange(i + 1, 2, 1, 6).setValues([[
        data.name,
        Number(data.price),
        data.description || "",
        data.imageUrl || "",
        data.size || "M",    // Changed from quantity to size
        data.category || "General"
      ]]);
      return { success: true };
    }
  }
  return { success: false };
}

function deleteProduct(data) {
  const sh = getSheet("PRODUCTS");
  const rows = sh.getDataRange().getValues();

  for (let i = 1; i < rows.length; i++) {
    if (rows[i][0] === data.id) {
      sh.deleteRow(i + 1);
      return { success: true };
    }
  }
  return { success: false };
}

/* ================= CHECKOUT & ORDERS ================= */

function checkout(data) {
  const orderId = genOrderId();

  const items = data.cart.map(item => ({
    productId: item.id,
    name: item.name,
    price: item.price,
    size: item.size,        // Changed from quantity to size
    subtotal: item.price    // Removed quantity multiplication since size doesn't affect price
  }));

  getSheet("ORDERS").appendRow([
    orderId,
    data.email,
    Number(data.total),
    "pending",
    data.address || "",
    data.phone || "",
    data.name || "",
    data.payment || "COD",
    JSON.stringify(items),
    new Date().toISOString()
  ]);

  // No stock reduction needed since we're using size

  return { success: true, orderId };
}

function getOrders(data) {
  const orders = getSheet("ORDERS").getDataRange().getValues().slice(1);

  const result = orders
    .filter(o => data.role === "admin" || o[1] === data.email)
    .map(o => ({
      id: o[0],
      email: o[1],
      total: o[2],
      status: o[3],
      address: o[4],
      phone: o[5],
      name: o[6],
      payment: o[7],
      items: JSON.parse(o[8] || "[]"),
      date: o[9]
    }));

  return { success: true, data: result };
}

function getOrderDetails(data) {
  const rows = getSheet("ORDERS").getDataRange().getValues();

  for (let i = 1; i < rows.length; i++) {
    if (rows[i][0] === data.orderId) {
      return {
        success: true,
        order: {
          id: rows[i][0],
          email: rows[i][1],
          total: rows[i][2],
          status: rows[i][3],
          address: rows[i][4],
          phone: rows[i][5],
          name: rows[i][6],
          payment: rows[i][7],
          items: JSON.parse(rows[i][8] || "[]"),
          date: rows[i][9]
        }
      };
    }
  }
  return { success: false };
}

function updateOrderStatus(data) {
  const sh = getSheet("ORDERS");
  const rows = sh.getDataRange().getValues();

  for (let i = 1; i < rows.length; i++) {
    if (rows[i][0] === data.orderId) {
      sh.getRange(i + 1, 4).setValue(data.status);
      return { success: true };
    }
  }
  return { success: false };
}

/* ================= HELPERS ================= */

function genId() {
  return "id_" + Date.now() + "_" + Math.random().toString(36).slice(2, 6);
}

function genOrderId() {
  return (
    "ORD" +
    Utilities.formatDate(new Date(), "GMT", "yyMMdd") +
    Math.random().toString(36).slice(2, 6).toUpperCase()
  );
}

function sendResponse(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
