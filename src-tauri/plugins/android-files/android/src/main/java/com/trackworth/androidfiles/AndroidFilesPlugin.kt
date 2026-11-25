package com.trackworth.androidfiles

import android.app.Activity
import android.content.Intent
import androidx.activity.result.ActivityResult
import app.tauri.annotation.ActivityCallback
import app.tauri.annotation.Command
import app.tauri.annotation.InvokeArg
import app.tauri.annotation.TauriPlugin
import app.tauri.plugin.Invoke
import app.tauri.plugin.JSObject
import app.tauri.plugin.Plugin

@InvokeArg
class SaveArgs {
    var fileName: String = "export.txt"
    var mimeType: String = "text/plain"
    var contents: String = ""
}

/**
 * "Save to…" for TrackWorth exports (ADR-0016). Android's document picker lets the user choose
 * where the file goes (Downloads, Drive, …); the app gets access to that one document only.
 */
@TauriPlugin
class AndroidFilesPlugin(private val activity: Activity) : Plugin(activity) {
    @Command
    fun save(invoke: Invoke) {
        val args = invoke.parseArgs(SaveArgs::class.java)
        val intent = Intent(Intent.ACTION_CREATE_DOCUMENT)
            .addCategory(Intent.CATEGORY_OPENABLE)
            .setType(args.mimeType)
            .putExtra(Intent.EXTRA_TITLE, args.fileName)
        startActivityForResult(invoke, intent, "onDocumentChosen")
    }

    @ActivityCallback
    fun onDocumentChosen(invoke: Invoke, result: ActivityResult) {
        val uri = result.data?.data
        if (result.resultCode != Activity.RESULT_OK || uri == null) {
            invoke.resolve(JSObject().put("saved", false))
            return
        }
        val args = invoke.parseArgs(SaveArgs::class.java)
        try {
            // "wt": write, truncating anything already there.
            activity.contentResolver.openOutputStream(uri, "wt")?.use {
                it.write(args.contents.toByteArray(Charsets.UTF_8))
            } ?: return invoke.reject("no output stream")
            invoke.resolve(JSObject().put("saved", true))
        } catch (e: Exception) {
            invoke.reject(e.message ?: "write failed")
        }
    }
}
