package com.maodou.nexussender

import android.annotation.SuppressLint
import android.content.Intent
import android.os.Build
import android.os.Bundle
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.Button
import android.widget.TextView
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity
import androidx.core.app.ActivityCompat

/**
 * Nexus 发送端：
 *  1) 内嵌 WebView 打开 ws.fseatech.cn（真实浏览器内核，极验滑块可正常通过）
 *  2) 「抓取 Token」：从网页 localStorage 里取 JWT
 *  3) 「开启共享」：起前台服务，把 Token 通过局域网发给手表
 *  手表端：http://<本机IP>:8123/token.json  （手表上可手动填这个 IP）
 */
class MainActivity : AppCompatActivity() {

    private lateinit var web: WebView
    private lateinit var tvStatus: TextView
    private lateinit var tvAddr: TextView
    private lateinit var btnToggle: Button

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_main)

        web = findViewById(R.id.web)
        tvStatus = findViewById(R.id.tvStatus)
        tvAddr = findViewById(R.id.tvAddr)
        btnToggle = findViewById(R.id.btnToggle)

        web.settings.javaScriptEnabled = true
        web.settings.domStorageEnabled = true
        web.webViewClient = WebViewClient()
        web.loadUrl("https://ws.fseatech.cn")

        findViewById<Button>(R.id.btnGrab).setOnClickListener { grabToken() }
        btnToggle.setOnClickListener { toggleShare() }

        if (Build.VERSION.SDK_INT >= 33) {
            try {
                ActivityCompat.requestPermissions(
                    this, arrayOf(android.Manifest.permission.POST_NOTIFICATIONS), 1
                )
            } catch (e: Exception) {}
        }
        refreshUi()
    }

    /** 从网页里取 Token：先看 localStorage.token，否则遍历找 eyJ 开头的值 */
    private fun grabToken() {
        val js = """
            (function(){
              try {
                var t = localStorage.getItem('token');
                if (t && t.length > 40 && t.indexOf('eyJ') === 0) return t;
                for (var i = 0; i < localStorage.length; i++) {
                  var k = localStorage.key(i), v = localStorage.getItem(k);
                  if (typeof v === 'string' && v.length > 40) {
                    var s = v.trim();
                    if (s.indexOf('eyJ') === 0) return s;
                    if (s.charAt(0) === '{') {
                      try {
                        var o = JSON.parse(s);
                        var c = o.token || o.accessToken || o.access_token;
                        if (c && c.indexOf('eyJ') === 0) return c;
                      } catch (e) {}
                    }
                  }
                }
              } catch (e) {}
              return '';
            })()
        """.trimIndent()

        web.evaluateJavascript(js) { raw ->
            val t = raw?.trim('"')?.replace("\\u003d", "=")?.replace("\\/", "/") ?: ""
            if (t.length < 100 || !t.startsWith("eyJ")) {
                Toast.makeText(this, "没抓到 Token（先在下面网页里登录成功）", Toast.LENGTH_LONG).show()
                return@evaluateJavascript
            }
            TokenService.token = t
            Toast.makeText(this, "已抓到 Token（${t.length} 字符）", Toast.LENGTH_LONG).show()
            refreshUi()
        }
    }

    private fun toggleShare() {
        if (TokenService.token.isEmpty()) {
            Toast.makeText(this, "请先点「抓取 Token」", Toast.LENGTH_SHORT).show()
            return
        }
        val it = Intent(this, TokenService::class.java)
        if (TokenService.running) {
            stopService(it)
        } else {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) startForegroundService(it) else startService(it)
        }
        web.postDelayed({ refreshUi() }, 500)
    }

    private fun refreshUi() {
        val ip = localIpv4()
        val hasToken = TokenService.token.isNotEmpty()
        tvStatus.text = "① 在下方网页登录 → ② 抓取 Token → ③ 开启共享" +
                if (hasToken) "\nToken：${TokenService.token.length} 字符 ✓" else "\nToken：未抓取"
        if (TokenService.running && ip.isNotEmpty()) {
            tvAddr.text = "手表填这个地址：$ip\n（端口 ${TokenService.PORT}）"
            btnToggle.text = "停止共享"
        } else {
            tvAddr.text = if (hasToken) "点「开启共享」后这里会显示手表要填的地址" else ""
            btnToggle.text = "开启共享"
        }
    }

    override fun onResume() {
        super.onResume()
        refreshUi()
    }

    override fun onDestroy() {
        web.destroy()
        super.onDestroy()
    }
}
