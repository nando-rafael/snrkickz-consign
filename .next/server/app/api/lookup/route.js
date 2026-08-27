"use strict";(()=>{var e={};e.id=2720,e.ids=[2720],e.modules={2934:e=>{e.exports=require("next/dist/client/components/action-async-storage.external.js")},4580:e=>{e.exports=require("next/dist/client/components/request-async-storage.external.js")},5869:e=>{e.exports=require("next/dist/client/components/static-generation-async-storage.external.js")},399:e=>{e.exports=require("next/dist/compiled/next-server/app-page.runtime.prod.js")},517:e=>{e.exports=require("next/dist/compiled/next-server/app-route.runtime.prod.js")},2254:e=>{e.exports=require("node:buffer")},6005:e=>{e.exports=require("node:crypto")},7261:e=>{e.exports=require("node:util")},5261:(e,t,r)=>{r.r(t),r.d(t,{originalPathname:()=>v,patchFetch:()=>I,requestAsyncStorage:()=>y,routeModule:()=>f,serverHooks:()=>h,staticGenerationAsyncStorage:()=>g});var n={};r.r(n),r.d(n,{GET:()=>m,dynamic:()=>l,runtime:()=>p});var i=r(9303),o=r(8716),a=r(670),s=r(7070),u=r(5456),d=r(7965),c=r(5844);let l="force-dynamic",p="nodejs";async function m(e){if(!await (0,u.Gg)())return s.NextResponse.json({error:"Niet ingelogd"},{status:401});let{searchParams:t}=new URL(e.url),r=(t.get("query")||"").trim().replace(/\s+/g," ");if(!r)return s.NextResponse.json({error:"Zoek op stylecode, SKU of productnaam"},{status:400});try{let e=await (0,d.qL)(r);if(0===e.length)return s.NextResponse.json({error:`Geen product gevonden voor "${r}". Controleer de stylecode, SKU of productnaam.`},{status:404});let t=(0,c.Tn)();return s.NextResponse.json({feePct:t,products:e.map(e=>({productId:e.productId,productTitle:e.productTitle,imageUrl:e.imageUrl,sku:e.sku,variantCount:e.variants.length,variants:e.variants.map(e=>{let r=parseFloat(e.price),n=Math.floor(r*(1-t/100));return{id:e.id,size:e.size,currentPrice:r,maxPayout:Math.max(1,Math.round(n-10))}})}))})}catch(e){return s.NextResponse.json({error:`Shopify fout: ${e.message}`},{status:502})}}let f=new i.AppRouteRouteModule({definition:{kind:o.x.APP_ROUTE,page:"/api/lookup/route",pathname:"/api/lookup",filename:"route",bundlePath:"app/api/lookup/route"},resolvedPagePath:"/root/repo/src/app/api/lookup/route.ts",nextConfigOutput:"",userland:n}),{requestAsyncStorage:y,staticGenerationAsyncStorage:g,serverHooks:h}=f,v="/api/lookup/route";function I(){return(0,a.patchFetch)({serverHooks:h,staticGenerationAsyncStorage:g})}},5456:(e,t,r)=>{r.d(t,{GJ:()=>l,Gg:()=>d,ed:()=>u,sd:()=>c});var n=r(6091),i=r(6176),o=r(1615);let a="consign_session";function s(){return new TextEncoder().encode(process.env.AUTH_SECRET||"dev-secret-change-me")}async function u(e){let t=await new n.N(e).setProtectedHeader({alg:"HS256"}).setExpirationTime("30d").sign(s());(0,o.cookies)().set(a,t,{httpOnly:!0,sameSite:"lax",secure:!0,path:"/",maxAge:2592e3})}async function d(){try{let e=o.cookies().get(a)?.value;if(!e)return null;let{payload:t}=await (0,i._)(e,s());return{id:t.id,email:t.email,name:t.name}}catch{return null}}function c(){(0,o.cookies)().delete(a)}function l(e){return!!e&&(process.env.ADMIN_EMAILS||"").toLowerCase().split(",").map(e=>e.trim()).filter(Boolean).includes(e.toLowerCase())}},5844:(e,t,r)=>{function n(){let e=parseFloat(process.env.FEE_PCT||"15");return isNaN(e)||e<0||e>=100?15:e}function i(e){return Math.ceil(e/(1-n()/100))}function o(e){return Math.round(e-.15*e-10)}function a(e){return`€${e.toLocaleString("nl-NL",{minimumFractionDigits:0,maximumFractionDigits:2})}`}r.d(t,{Al:()=>o,Sz:()=>i,Tn:()=>n,at:()=>a})},7965:(e,t,r)=>{function n(e){let t=process.env[e];if(!t)throw Error(`Ontbrekende env variabele: ${e}`);return t}r.d(t,{V_:()=>d,XF:()=>p,Zn:()=>y,bb:()=>m,cl:()=>f,oI:()=>l,qL:()=>c});let i=globalThis;async function o(){let e=process.env.SHOPIFY_ADMIN_TOKEN;if(e)return e;let t=i.__shopifyToken;if(t&&t.expiresAt>Date.now()+6e4)return t.token;let r=await fetch(`https://${n("SHOPIFY_STORE_DOMAIN")}/admin/oauth/access_token`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({grant_type:"client_credentials",client_id:n("SHOPIFY_CLIENT_ID"),client_secret:n("SHOPIFY_CLIENT_SECRET")}),cache:"no-store"});if(!r.ok)throw Error(`Token ophalen mislukt (${r.status}): ${await r.text()}. Check SHOPIFY_CLIENT_ID/SECRET en of de app op de store is ge\xefnstalleerd.`);let o=await r.json();return i.__shopifyToken={token:o.access_token,expiresAt:Date.now()+(o.expires_in??3600)*1e3},o.access_token}async function a(e,t={}){let r=await o(),i=await fetch(`https://${n("SHOPIFY_STORE_DOMAIN")}/admin/api/2025-01/graphql.json`,{method:"POST",headers:{"Content-Type":"application/json","X-Shopify-Access-Token":r},body:JSON.stringify({query:e,variables:t}),cache:"no-store"});if(!i.ok)throw Error(`Shopify API ${i.status}: ${await i.text()}`);let a=await i.json();if(a.errors)throw Error(JSON.stringify(a.errors));return a.data}let s=`
  id
  sku
  title
  price
  inventoryQuantity
  inventoryItem { id }
  product {
    id
    title
    featuredMedia { preview { image { url } } }
  }
`;function u(e){return{id:e.id,sku:e.sku,size:e.title,price:e.price,inventoryQuantity:e.inventoryQuantity??0,inventoryItemId:e.inventoryItem?.id}}async function d(e){let t=await c(e);return t.length>0?t[0]:null}async function c(e){let t=await a(`query ($q: String!) {
      productVariants(first: 100, query: $q) {
        nodes { ${s} }
      }
    }`,{q:`sku:${e}`}),r=(t?.productVariants?.nodes??[]).filter(t=>(t.sku||"").toUpperCase()===e.toUpperCase());if(r.length>0){let e=new Map;for(let t of r){let r=t.product?.id??"";e.has(r)||e.set(r,[]),e.get(r).push(t)}return Array.from(e.values()).map(e=>{let t=e[0].product;return{productId:t?.id,productTitle:t?.title,imageUrl:t?.featuredMedia?.preview?.image?.url??null,sku:e[0].sku,variants:e.map(u)}})}let n=await a(`query ($q: String!) {
      products(first: 20, query: $q) {
        nodes {
          id
          title
          featuredMedia { preview { image { url } } }
          variants(first: 100) {
            nodes {
              id
              sku
              title
              price
              inventoryQuantity
              inventoryItem { id }
            }
          }
        }
      }
    }`,{q:`title:*${e}*`}),i=n?.products?.nodes??[];return 0===i.length?[]:i.map(e=>{let t=e.variants?.nodes??[];return 0===t.length?null:{productId:e.id,productTitle:e.title,imageUrl:e.featuredMedia?.preview?.image?.url??null,sku:t[0].sku??"",variants:t.map(e=>({id:e.id,sku:e.sku,size:e.title,price:e.price,inventoryQuantity:e.inventoryQuantity??0,inventoryItemId:e.inventoryItem?.id}))}}).filter(e=>null!==e)}async function l(e){return d(e)}async function p(e){let t=await a(`query ($id: ID!) {
      node(id: $id) {
        ... on ProductVariant { ${s} }
      }
    }`,{id:e}),r=t?.node;return r?.id?{...u(r),productId:r.product?.id,productTitle:r.product?.title,imageUrl:r.product?.featuredMedia?.preview?.image?.url??null}:null}async function m(e,t){let r=await a(`mutation ($input: InventoryAdjustQuantitiesInput!) {
      inventoryAdjustQuantities(input: $input) {
        userErrors { field message }
      }
    }`,{input:{reason:"correction",name:"available",changes:[{delta:t,inventoryItemId:e,locationId:n("SHOPIFY_LOCATION_ID")}]}}),i=r?.inventoryAdjustQuantities?.userErrors??[];if(i.length)throw Error(i.map(e=>e.message).join("; "))}async function f(e,t,r){let n=await a(`mutation ($productId: ID!, $variants: [ProductVariantsBulkInput!]!) {
      productVariantsBulkUpdate(productId: $productId, variants: $variants) {
        userErrors { field message }
      }
    }`,{productId:e,variants:[{id:t,price:r.toFixed(2)}]}),i=n?.productVariantsBulkUpdate?.userErrors??[];if(i.length)throw Error(i.map(e=>e.message).join("; "))}async function y(e,t){let r=await a(`mutation ($id: ID!, $productIds: [ID!]!) {
      collectionAddProducts(id: $id, productIds: $productIds) {
        userErrors { field message }
      }
    }`,{id:t,productIds:[e]}),n=r?.collectionAddProducts?.userErrors??[];n.length&&console.error(`addProductToCollection userErrors: ${n.map(e=>e.message).join("; ")}`)}}};var t=require("../../../webpack-runtime.js");t.C(e);var r=e=>t(t.s=e),n=t.X(0,[9380,8840,5972],()=>r(5261));module.exports=n})();