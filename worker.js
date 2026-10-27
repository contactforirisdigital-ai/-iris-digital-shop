const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "https://iris-digital-shop.pages.dev",
  "Access-Control-Allow-Methods": "GET,POST,PATCH,DELETE,OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, X-Admin-Token",
  "Access-Control-Max-Age": "86400"
};
const SEED = [
  {name:"Thiệp A Little More Magic",category:"Thiệp số",price:19000,tag:"Bán chạy",art:"art1",mini:"A little<br>more magic",desc:"Thiệp số thanh lịch có thể cá nhân hóa tên người nhận và lời chúc."},
  {name:"Template Presentation Morph",category:"Template slide",price:49000,tag:"Nổi bật",art:"art2",mini:"IDEAS<br>IN MOTION",desc:"Bộ slide hiện đại với bố cục chuyên nghiệp và gợi ý chuyển động."},
  {name:"Prompt AI — Product Glow",category:"Prompt AI",price:9000,tag:"Giá tốt",art:"art3",mini:"PRODUCT<br>GLOW",desc:"Bộ prompt hỗ trợ tạo ảnh sản phẩm phong cách studio."},
  {name:"Planner tối giản",category:"Tài liệu số",price:29000,tag:"",art:"art4",mini:"A softer<br>routine",desc:"Bộ planner có cấu trúc rõ ràng để lập kế hoạch và theo dõi công việc."},
  {name:"Thiệp Love in Bloom",category:"Thiệp số",price:29000,tag:"Mới",art:"art5",mini:"LOVE IN<br>BLOOM",desc:"Mẫu thiệp lãng mạn phù hợp sinh nhật, kỷ niệm và những lời nhắn riêng."},
  {name:"Prompt Cinematic Story",category:"Prompt AI",price:19000,tag:"",art:"art6",mini:"TELL YOUR<br>STORY",desc:"Prompt gợi ý hình ảnh và cảnh quay mang phong cách điện ảnh."},
  {name:"Social Creator Kit",category:"Creator kit",price:79000,tag:"Bundle",art:"art7",mini:"CREATE<br>WITH INTENT",desc:"Bộ tài nguyên khởi đầu cho nội dung mạng xã hội."},
  {name:"Portfolio Editorial",category:"Tài liệu số",price:39000,tag:"",art:"art8",mini:"YOUR<br>PORTFOLIO",desc:"Mẫu portfolio gọn gàng, dễ điều chỉnh nội dung và hình ảnh."}
];
function json(data,status=200,origin="") {
  const h = new Headers({"Content-Type":"application/json; charset=utf-8","Cache-Control":"no-store",...CORS_HEADERS});
  if (origin === "null") h.set("Access-Control-Allow-Origin","https://iris-digital-shop.pages.dev");
  return new Response(JSON.stringify(data),{status,headers:h});
}
function slugify(s){return String(s||"product").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().trim().replace(/[^a-z0-9]+/g,"-").replace(/^-+|-+$/g,"").slice(0,100)||"product";}
async function init(db) {
  await db.prepare(`CREATE TABLE IF NOT EXISTS iris_products (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    slug TEXT NOT NULL UNIQUE,
    category TEXT NOT NULL DEFAULT 'Sản phẩm khác',
    price INTEGER NOT NULL DEFAULT 0,
    tag TEXT NOT NULL DEFAULT '',
    art TEXT NOT NULL DEFAULT 'art8',
    mini TEXT NOT NULL DEFAULT '',
    description TEXT NOT NULL DEFAULT '',
    preview_image TEXT NOT NULL DEFAULT '',
    preview_url TEXT NOT NULL DEFAULT '',
    delivery_url TEXT NOT NULL DEFAULT '',
    download_url TEXT NOT NULL DEFAULT '',
    is_active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`).run();
}
function rowToProduct(r){return {id:Number(r.id),name:r.name,category:r.category,price:Number(r.price),tag:r.tag||"",art:r.art||"art8",mini:r.mini||r.name,desc:r.description||"",previewImage:r.preview_image||"",previewUrl:r.preview_url||"",deliveryUrl:r.delivery_url||"",downloadUrl:r.download_url||"",is_active:Number(r.is_active)};}
async function seedIfEmpty(db) {
  const n=await db.prepare("SELECT COUNT(*) AS n FROM iris_products").first();
  if(Number(n?.n||0)!==0)return;
  for(const p of SEED){
    await db.prepare(`INSERT OR IGNORE INTO iris_products
      (name,slug,category,price,tag,art,mini,description,is_active)
      VALUES(?,?,?,?,?,?,?,?,1)`).bind(p.name,slugify(p.name),p.category,p.price,p.tag,p.art,p.mini,p.desc).run();
  }
}
function isAdmin(request,env){const token=request.headers.get("X-Admin-Token")||"";return !!env.ADMIN_TOKEN && token.length>0 && token===env.ADMIN_TOKEN;}
async function readBody(request){try{return await request.json()}catch{return null}}
export default {
 async fetch(request,env){
  const origin=request.headers.get("Origin")||"";
  if(request.method==="OPTIONS")return new Response(null,{status:204,headers:CORS_HEADERS});
  const url=new URL(request.url), path=url.pathname;
  try{
   if(!env.DB)return json({success:false,error:"D1 binding DB is missing"},500,origin);
   if(path==="/health")return json({ok:true,service:"IRIS Digital API"},200,origin);
   await init(env.DB);
   if(path==="/api/products"&&request.method==="GET"){
     await seedIfEmpty(env.DB);
     const {results=[]}=await env.DB.prepare("SELECT * FROM iris_products WHERE is_active=1 ORDER BY id ASC").all();
     return json({success:true,products:results.map(rowToProduct)},200,origin);
   }
   if(path==="/api/admin/login"&&request.method==="POST"){
     const b=await readBody(request);
     if(!env.ADMIN_TOKEN||!b||b.token!==env.ADMIN_TOKEN)return json({success:false,error:"Unauthorized"},401,origin);
     return json({success:true},200,origin);
   }
   if(path.startsWith("/api/admin/")){
     if(!isAdmin(request,env))return json({success:false,error:"Unauthorized"},401,origin);
     if(path==="/api/admin/products"&&request.method==="GET"){
       const {results=[]}=await env.DB.prepare("SELECT * FROM iris_products ORDER BY id ASC").all();
       return json({success:true,products:results.map(rowToProduct)},200,origin);
     }
     if(path==="/api/admin/products"&&request.method==="POST"){
       const b=await readBody(request); if(!b||!String(b.name||"").trim()||!Number.isFinite(Number(b.price))||Number(b.price)<0)return json({success:false,error:"Tên và giá sản phẩm không hợp lệ."},400,origin);
       const slug=slugify(b.name)+"-"+Date.now().toString(36);
       const result=await env.DB.prepare(`INSERT INTO iris_products
       (name,slug,category,price,tag,art,mini,description,preview_image,preview_url,delivery_url,download_url,is_active,updated_at)
       VALUES(?,?,?,?,?,?,?,?,?,?,?,?,1,CURRENT_TIMESTAMP)`).bind(String(b.name).trim(),slug,String(b.category||"Sản phẩm khác"),Math.round(Number(b.price)),String(b.tag||""),String(b.art||"art8"),String(b.mini||b.name).slice(0,100),String(b.desc||""),String(b.previewImage||""),String(b.previewUrl||""),String(b.deliveryUrl||""),String(b.downloadUrl||"")).run();
       return json({success:true,id:result.meta?.last_row_id},201,origin);
     }
     const match=path.match(/^\/api\/admin\/products\/(\d+)$/);
     if(match&&request.method==="PATCH"){
       const id=Number(match[1]),b=await readBody(request); if(!b)return json({success:false,error:"JSON không hợp lệ"},400,origin);
       const existing=await env.DB.prepare("SELECT * FROM iris_products WHERE id=?").bind(id).first();
       if(!existing)return json({success:false,error:"Không tìm thấy sản phẩm"},404,origin);
       const p={...rowToProduct(existing),...b};
       if(!String(p.name||"").trim()||!Number.isFinite(Number(p.price))||Number(p.price)<0)return json({success:false,error:"Tên hoặc giá không hợp lệ"},400,origin);
       await env.DB.prepare(`UPDATE iris_products SET name=?,category=?,price=?,tag=?,art=?,mini=?,description=?,preview_image=?,preview_url=?,delivery_url=?,download_url=?,is_active=?,updated_at=CURRENT_TIMESTAMP WHERE id=?`)
       .bind(String(p.name).trim(),String(p.category||"Sản phẩm khác"),Math.round(Number(p.price)),String(p.tag||""),String(p.art||"art8"),String(p.mini||p.name),String(p.desc||""),String(p.previewImage||""),String(p.previewUrl||""),String(p.deliveryUrl||""),String(p.downloadUrl||""),Number(p.is_active??1)?1:0,id).run();
       return json({success:true},200,origin);
     }
     if(match&&request.method==="DELETE"){
       const id=Number(match[1]); await env.DB.prepare("DELETE FROM iris_products WHERE id=?").bind(id).run();return json({success:true},200,origin);
     }
   }
   return json({success:false,error:"Not found"},404,origin);
  }catch(e){return json({success:false,error:"Internal API error",detail:String(e?.message||e)},500,origin)}
 }
};
