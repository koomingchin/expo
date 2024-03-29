package expo.modules.barcodescanner

import android.content.Context
import expo.modules.core.BasePackage
import expo.modules.core.ExportedModule
import expo.modules.core.ViewManager
import expo.modules.core.interfaces.InternalModule

class BarCodeScannerPackage : BasePackage() {
  override fun createInternalModules(context: Context): List<InternalModule> {
    return listOf(BarCodeScannerProvider())
  }

  override fun createExportedModules(context: Context): List<ExportedModule> {
    return listOf(BarCodeScannerModule(context))
  }

  override fun createViewManagers(context: Context): List<ViewManager<*>> {
    return listOf(BarCodeScannerViewManager())
  }
}
