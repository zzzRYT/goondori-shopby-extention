export default defineContentScript({
  matches: ['<all_urls>'],
  main() {
    console.log('Goondori Shopby extension content script loaded');
  },
});
