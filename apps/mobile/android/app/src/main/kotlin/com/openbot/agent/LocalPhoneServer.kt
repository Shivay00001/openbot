package com.openbot.agent

import org.json.JSONObject
import java.io.BufferedReader
import java.io.InputStreamReader
import java.io.PrintWriter
import java.net.ServerSocket
import java.net.Socket
import kotlin.concurrent.thread

/**
 * OpenBot Embedded On-Device HTTP Server
 * Runs directly on the Android phone at port 8765.
 * Enables zero-latency local REST control of the phone's accessibility automation engine.
 */
class LocalPhoneServer(private val port: Int = 8765) {

    private var serverSocket: ServerSocket? = null
    private var isRunning = false

    fun start() {
        if (isRunning) return
        isRunning = true

        thread(name = "OpenBot-PhoneServer-Thread", isDaemon = true) {
            try {
                serverSocket = ServerSocket(port)
                while (isRunning) {
                    val clientSocket = serverSocket?.accept() ?: break
                    thread(isDaemon = true) {
                        handleClient(clientSocket)
                    }
                }
            } catch (e: Exception) {
                // Server stopped or interrupted
            }
        }
    }

    fun stop() {
        isRunning = false
        serverSocket?.close()
        serverSocket = null
    }

    private fun handleClient(socket: Socket) {
        try {
            val reader = BufferedReader(InputStreamReader(socket.getInputStream()))
            val writer = PrintWriter(socket.getOutputStream(), true)

            val requestLine = reader.readLine() ?: return
            val parts = requestLine.split(" ")
            if (parts.size < 2) return

            val method = parts[0]
            val path = parts[1]

            // Read HTTP headers
            var contentLength = 0
            var line: String? = reader.readLine()
            while (!line.isNullOrEmpty()) {
                if (line.lowercase().startsWith("content-length:")) {
                    contentLength = line.substring(15).trim().toIntOrNull() ?: 0
                }
                line = reader.readLine()
            }

            // Read JSON body if present
            var body = ""
            if (contentLength > 0) {
                val charBuf = CharArray(contentLength)
                reader.read(charBuf, 0, contentLength)
                body = String(charBuf)
            }

            val responseJson = handleRoute(method, path, body)
            val responseBytes = responseJson.toByteArray(Charsets.UTF_8)

            writer.print("HTTP/1.1 200 OK\r\n")
            writer.print("Content-Type: application/json\r\n")
            writer.print("Access-Control-Allow-Origin: *\r\n")
            writer.print("Content-Length: ${responseBytes.size}\r\n")
            writer.print("\r\n")
            writer.flush()

            socket.getOutputStream().write(responseBytes)
            socket.getOutputStream().flush()
        } catch (e: Exception) {
            // Handled
        } finally {
            socket.close()
        }
    }

    private fun handleRoute(method: String, path: String, body: String): String {
        val service = OpenBotAccessibilityService.instance
        val res = JSONObject()

        if (service == null) {
            res.put("success", false)
            res.put("error", "Accessibility Service is not enabled. Please enable it in Android Settings > Accessibility.")
            return res.toString()
        }

        when {
            path == "/health" -> {
                res.put("success", true)
                res.put("serviceActive", true)
                res.put("isRootless", true)
                res.put("version", "0.1.0")
            }
            path == "/screen/hierarchy" && method == "GET" -> {
                return service.getHierarchyJson()
            }
            path == "/action/tap" && method == "POST" -> {
                val json = try { JSONObject(body) } catch (_: Exception) { JSONObject() }
                val text = json.optString("text")
                val viewId = json.optString("viewId")
                val x = json.optDouble("x", -1.0)
                val y = json.optDouble("y", -1.0)

                val success = when {
                    text.isNotEmpty() -> service.clickByText(text)
                    viewId.isNotEmpty() -> service.clickById(viewId)
                    x >= 0 && y >= 0 -> service.tapCoordinate(x.toFloat(), y.toFloat())
                    else -> false
                }
                res.put("success", success)
                res.put("action", "tap")
            }
            path == "/action/type" && method == "POST" -> {
                val json = try { JSONObject(body) } catch (_: Exception) { JSONObject() }
                val text = json.optString("text", "")
                val success = service.typeText(text)
                res.put("success", success)
                res.put("typed", text)
            }
            path == "/action/swipe" && method == "POST" -> {
                val json = try { JSONObject(body) } catch (_: Exception) { JSONObject() }
                val fromX = json.optDouble("fromX", 500.0).toFloat()
                val fromY = json.optDouble("fromY", 1500.0).toFloat()
                val toX = json.optDouble("toX", 500.0).toFloat()
                val toY = json.optDouble("toY", 500.0).toFloat()
                val duration = json.optLong("duration", 300)
                val success = service.swipe(fromX, fromY, toX, toY, duration)
                res.put("success", success)
            }
            path == "/action/key" && method == "POST" -> {
                val json = try { JSONObject(body) } catch (_: Exception) { JSONObject() }
                val key = json.optString("key", "BACK").uppercase()
                val success = when (key) {
                    "HOME" -> service.pressHome()
                    "RECENTS" -> service.pressRecents()
                    else -> service.pressBack()
                }
                res.put("success", success)
                res.put("key", key)
            }
            path == "/action/launch" && method == "POST" -> {
                val json = try { JSONObject(body) } catch (_: Exception) { JSONObject() }
                val packageName = json.optString("packageName", "")
                val success = service.launchApp(packageName)
                res.put("success", success)
                res.put("packageName", packageName)
            }
            else -> {
                res.put("error", "Unknown endpoint: $path")
            }
        }
        return res.toString()
    }
}
