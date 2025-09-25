import { DragDrop, DragRef, moveItemInArray } from '@angular/cdk/drag-drop';
import { HttpClient } from '@angular/common/http';
import { ComponentRef, Injectable, TemplateRef, ViewContainerRef } from '@angular/core';
import { Platform } from '@ionic/angular';
import moment from 'moment';
import { Subject } from 'rxjs';
import { unsafeRandomHex } from 'src/app/helpers/random.helper';
import { Logger } from 'src/app/logger';
import { IdentityEntry } from 'src/app/model/didsessions/identityentry';
import { GlobalNativeService } from 'src/app/services/global.native.service';
import { GlobalPreferencesService } from 'src/app/services/global.preferences.service';
import { GlobalServiceManager } from 'src/app/services/global.service.manager';
import { GlobalStorageService } from 'src/app/services/global.storage.service';
import { GlobalTranslationService } from 'src/app/services/global.translation.service';
import { DIDSessionsStore } from 'src/app/services/stores/didsessions.store';
import { NetworkTemplateStore } from 'src/app/services/stores/networktemplate.store';
import type { PluginConfig } from '../base/pluginconfig';
import type { WidgetContainerComponent } from '../base/widget-container/widget-container.component';
import type { WidgetHolderComponent } from '../base/widget-holder/widget-holder.component';
import type { WidgetBase } from '../base/widgetbase';
import {
  BuiltInWidgetType,
  DisplayCategories,
  PluginType,
  WidgetContainerState,
  WidgetState
} from '../base/widgetstate';
import { WidgetsNewsService } from './news.service';
import { WidgetPluginsService } from './plugin.service';
import { WidgetsBuilder } from './widgets.builder';
import { WidgetsServiceEvents } from './widgets.events';

const PERSISTENCE_CONTEXT = 'launcher-widget';

const builtInWidgets: WidgetState[] = [
  {
    category: 'builtin',
    builtInType: 'identity',
    displayCategories: [DisplayCategories.IDENTITY],
    availableInLightweightMode: false
  },
  {
    category: 'builtin',
    builtInType: 'active-wallet',
    displayCategories: [DisplayCategories.FINANCE],
    availableInLightweightMode: true
  },
  {
    category: 'builtin',
    builtInType: 'active-network-coin-price',
    displayCategories: [DisplayCategories.FINANCE],
    availableInLightweightMode: true
  },
  {
    category: 'builtin',
    builtInType: 'choose-active-network',
    displayCategories: [DisplayCategories.FINANCE],
    availableInLightweightMode: true
  },
  {
    category: 'builtin',
    builtInType: 'signout',
    displayCategories: [DisplayCategories.IDENTITY],
    availableInLightweightMode: true
  },
  {
    category: 'builtin',
    builtInType: 'elastos-voting',
    displayCategories: [DisplayCategories.ELASTOS],
    availableInLightweightMode: false
  },
  {
    category: 'builtin',
    builtInType: 'elastos-staking',
    displayCategories: [DisplayCategories.ELASTOS],
    availableInLightweightMode: false
  },
  {
    category: 'builtin',
    builtInType: 'cyber-republic',
    displayCategories: [DisplayCategories.ELASTOS],
    availableInLightweightMode: false
  },
  {
    category: 'builtin',
    builtInType: 'recent-apps',
    displayCategories: [DisplayCategories.BROWSER],
    availableInLightweightMode: true
  },
  {
    category: 'builtin',
    builtInType: 'favorite-apps',
    displayCategories: [DisplayCategories.BROWSER],
    availableInLightweightMode: true
  },
  {
    category: 'builtin',
    builtInType: 'wallet-connect',
    displayCategories: [DisplayCategories.FINANCE],
    availableInLightweightMode: true
  },
  {
    category: 'builtin',
    builtInType: 'contacts',
    displayCategories: [DisplayCategories.COMMUNITY],
    availableInLightweightMode: false
  },
  {
    category: 'builtin',
    builtInType: 'red-packets',
    displayCategories: [DisplayCategories.COMMUNITY],
    availableInLightweightMode: false
  },
  {
    category: 'builtin',
    builtInType: 'hive',
    displayCategories: [DisplayCategories.ELASTOS],
    availableInLightweightMode: false
  },
  {
    category: 'builtin',
    builtInType: 'discover-dapps',
    displayCategories: [DisplayCategories.BROWSER],
    availableInLightweightMode: false
  },
  {
    category: 'builtin',
    builtInType: 'new-red-packets',
    displayCategories: [DisplayCategories.COMMUNITY],
    availableInLightweightMode: false
  },
  {
    category: 'builtin',
    builtInType: 'backup-identity',
    displayCategories: [DisplayCategories.IDENTITY],
    availableInLightweightMode: false
  },
  {
    category: 'builtin',
    builtInType: 'hive-sync',
    displayCategories: [DisplayCategories.IDENTITY],
    availableInLightweightMode: false
  },
  {
    category: 'builtin',
    builtInType: 'notifications',
    displayCategories: [DisplayCategories.COMMUNITY],
    availableInLightweightMode: true
  },
  {
    category: 'app-plugin',
    displayCategories: [DisplayCategories.COMMUNITY],
    plugin: { pluginType: 'news' },
    availableInLightweightMode: false
  }
];

const partnerPluginUrls = [
  'https://ela.city/api/templates/portal',
  'https://ela.city/api/templates/gallery/popular?size=6',
  'https://ela.city/api/templates/gallery/buyNow?size=6'
];

export type WidgetInstance = {
  widgetId: string; // Reference widget ID
  widget: WidgetBase; // Widget component instance (Angular Component implementing our widget interface)
  holderComponentRef: ComponentRef<any>; // Angular's UI element root for the widget HOLDER instance
  container: WidgetContainerComponent;
};

@Injectable({
  providedIn: 'root'
})
export class WidgetsService {
  public static instance: WidgetsService;
  public static isIOS = false;

  // List of widget components instantiated, so we can call the lifecycle on them
  private componentsInstances: WidgetInstance[] = [];
  private lightweightMode: boolean;

  private launcherHomeViewIsActive = false;
  private containerNames: string[] = []; // List of containers used on the home screen

  public onWidgetContainerContentReset = new Subject<string>(); // container name

  constructor(
    private globalStorageService: GlobalStorageService,
    private dragDrop: DragDrop,
    private http: HttpClient,
    private globalNative: GlobalNativeService,
    private globalPrefs: GlobalPreferencesService,
    private pluginService: WidgetPluginsService,
    private newsService: WidgetsNewsService,
    private platform: Platform
  ) {
    WidgetsService.instance = this;
    // TMP DEBUG
    /* void this.deleteContainerState("left");
        void this.deleteContainerState("right");
        void this.deleteContainerState("main"); */
  }

  init() {
    GlobalServiceManager.getInstance().registerService(this);

    WidgetsService.isIOS = this.platform.platforms().indexOf('android') < 0;
  }

  public async onUserSignIn(signedInIdentity: IdentityEntry): Promise<void> {
    this.lightweightMode = await this.globalPrefs.getLightweightMode(
      signedInIdentity.didString,
      NetworkTemplateStore.networkTemplate
    );
  }

  public onUserSignOut(): Promise<void> {
    // TODO: When is the best time to clean the componentsInstances?
    this.componentsInstances = [];
    return;
  }

  public getAvailableBuiltInWidgets(): WidgetState[] {
    // Honor lightweight mode: only expose widgets marked as available in lightweight mode
    if (this.lightweightMode) {
      return builtInWidgets.filter(w => w.availableInLightweightMode);
    }
    return builtInWidgets;
  }

  /**
   * Home screen to let this service know the list of containers in use.
   * This way, this service is able to search content in all existing containers.
   */
  public registerContainer(widgetContainerName: string) {
    if (!this.containerNames.includes(widgetContainerName)) {
      this.containerNames.push(widgetContainerName);
    }
  }

  /**
   * Toggle widgets edition mode globally for all home screen sub-screens / all widgets.
   */
  public toggleEditionMode() {
    const currentEditionMode = WidgetsServiceEvents.editionMode.value;
    WidgetsServiceEvents.editionMode.next(!currentEditionMode);
  }

  public enterEditionMode() {
    WidgetsServiceEvents.editionMode.next(true);
  }

  public exitEditionMode() {
    WidgetsServiceEvents.editionMode.next(false);
  }

  /**
   * Loads widget container state from disk. i.e. list of widgets it contains.
   */
  public async loadContainerState(widgetContainerName: string): Promise<WidgetContainerState> {
    if (!this.containerNames.includes(widgetContainerName))
      throw new Error(
        `Trying to load container '${widgetContainerName}' but it's not registered. Call registerContainer() first.`
      );

    const key = 'widget-container-state-' + widgetContainerName;
    let state = <WidgetContainerState>(
      await this.globalStorageService.getSetting(
        DIDSessionsStore.signedInDIDString,
        NetworkTemplateStore.networkTemplate,
        PERSISTENCE_CONTEXT,
        key,
        null
      )
    );

    if (!state) {
      // Generate and save a default configuration for the default container layout, if this is a well known default container name
      state = await this.generateDefaultContainerState(widgetContainerName);
      await this.saveContainerState(widgetContainerName, state); // Important, to preserve widget ids (deletion issue)
    }

    return state;
  }

  private async saveContainerState(widgetContainerName: string, state: WidgetContainerState): Promise<void> {
    const key = 'widget-container-state-' + widgetContainerName;
    await this.globalStorageService.setSetting(
      DIDSessionsStore.signedInDIDString,
      NetworkTemplateStore.networkTemplate,
      PERSISTENCE_CONTEXT,
      key,
      state
    );
  }

  /**
   * Restores a widget that was previously saved.
   * Called when the widgets container is instantiated.
   */
  public async restoreWidget(
    widgetContainer: WidgetContainerComponent,
    widget: WidgetState,
    widgetslist: ViewContainerRef,
    container: ViewContainerRef,
    boundaries: ViewContainerRef,
    dragPlaceholder: TemplateRef<any>
  ): Promise<{
    dragRef: DragRef;
    widgetHolderComponentRef: ComponentRef<WidgetHolderComponent>;
    widgetComponentInstance: WidgetBase;
  }> {
    let result = await WidgetsBuilder.appendWidgetFromState(
      widgetContainer.name,
      widget,
      widgetslist,
      container,
      boundaries,
      dragPlaceholder,
      this.dragDrop
    );
    if (result) {
      let { dragRef, widgetComponentInstance, widgetHolderComponentRef } = result;
      this.componentsInstances.push({
        widgetId: widget.id,
        widget: widgetComponentInstance,
        holderComponentRef: widgetHolderComponentRef,
        container: widgetContainer
      });

      return { dragRef, widgetHolderComponentRef, widgetComponentInstance };
    } else {
      return null;
    }
  }

  /**
   * Adds a new widget to the container model.
   * Called by user to add new widgets after picking a widget state from the widget chooser.
   */
  public async addWidget(
    widgetStateConfig: WidgetState,
    widgetContainer: WidgetContainerComponent,
    list: ViewContainerRef,
    container: ViewContainerRef,
    boundaries: ViewContainerRef,
    dragPlaceholder: TemplateRef<any>,
    forSelection = false
  ): Promise<{ dragRef: DragRef; widgetHolderComponentRef: ComponentRef<WidgetHolderComponent> }> {
    // If we add a widget for selection, we add widgets in the end, to show them in ther order they are defined.
    // For live mode, adding a new widget is always done at the top of the list.
    let insertAtTop = false;
    if (!forSelection) {
      insertAtTop = true;
    }

    let newWidgetState = this.createWidgetState(widgetStateConfig);

    let result = await WidgetsBuilder.appendWidgetFromState(
      widgetContainer.name,
      newWidgetState,
      list,
      container,
      boundaries,
      dragPlaceholder,
      !forSelection ? this.dragDrop : null, // Don't make the item draggable if in selection mode.
      insertAtTop ? 0 : undefined // Insert at the top if ndded
    );

    if (!result) {
      return null;
    }

    let { dragRef, widgetComponentInstance, widgetHolderComponentRef } = result;
    this.componentsInstances.push({
      widgetId: newWidgetState.id,
      widget: widgetComponentInstance,
      holderComponentRef: widgetHolderComponentRef,
      container: widgetContainer
    });
    //await widgetComponentInstance.onWidgetInit?.();

    // Live mode, not preview? Then save the sate
    if (!forSelection) {
      // Add to container state
      let state = await this.loadContainerState(widgetContainer.name);
      if (insertAtTop) state.widgets.unshift(newWidgetState); // New widget, insert first
      else state.widgets.push(newWidgetState); // Other cases, insert last

      // Save container to disk
      await this.saveContainerState(widgetContainer.name, state);
    }

    return { dragRef, widgetHolderComponentRef };
  }

  /**
   * Creates a new widget state with a unique ID, based on a widget state config/
   */
  public createWidgetState(widgetStateConfig: WidgetState): WidgetState {
    // Clone the template state to make sure we don't edit its fields.
    let newWidgetState: WidgetState = Object.assign({}, widgetStateConfig);

    // Assign a unique ID
    newWidgetState.id = unsafeRandomHex(8);

    return newWidgetState;
  }

  private createBuiltInWidgetState(builtInType: BuiltInWidgetType): WidgetState {
    let registeredBuiltInWidgetState = builtInWidgets.find(w => w.builtInType === builtInType);

    return this.createWidgetState({
      category: 'builtin',
      builtInType,
      displayCategories: registeredBuiltInWidgetState.displayCategories,
      availableInLightweightMode: registeredBuiltInWidgetState.availableInLightweightMode
    });
  }

  private createPluginWidgetState(pluginType: PluginType): WidgetState {
    let registeredBuiltInWidgetState = builtInWidgets.find(
      w => w.category === 'app-plugin' && w.plugin.pluginType === pluginType
    );

    return this.createWidgetState({
      category: 'app-plugin',
      displayCategories: registeredBuiltInWidgetState.displayCategories,
      availableInLightweightMode: registeredBuiltInWidgetState.availableInLightweightMode,
      plugin: {
        pluginType
      }
    });
  }

  /**
   * Moves a widget in the model and saves the state to disk.
   * Calling UI component is reponsible for moving items on UI.
   */
  public async moveWidget(widgetContainerName: string, previousIndex: number, currentIndex: number) {
    let state = await this.loadContainerState(widgetContainerName);
    moveItemInArray(state.widgets, previousIndex, currentIndex);
    await this.saveContainerState(widgetContainerName, state);
  }

  /**
   * Removes a widget from a widget container but not from the the persistance state.
   */
  public async removeWidget(widgetId: string): Promise<{ widgetInstance: WidgetInstance }> {
    // Find the widget
    let widgetIndex = this.componentsInstances.findIndex(w => w.widgetId === widgetId);
    let widgetInstance = this.componentsInstances[widgetIndex];

    if (widgetInstance) {
      // Just in case of legacy wrong widget state info
      // Deinit the holder and the widget
      await widgetInstance.holderComponentRef.instance.onWidgetDeinit?.();

      // Delete from UI
      await widgetInstance.container.onWidgetDeletion(widgetInstance, widgetInstance.holderComponentRef.hostView);
    }

    return { widgetInstance };
  }

  /**
   * Deletes a widget from the model and sends an event to let the widget container know that
   * a removal from UI is needed too
   */
  public async deleteWidget(widgetId: string) {
    let { containerName } = await this.findInAllContainers(widgetState => widgetState.id === widgetId);

    await this.removeWidget(widgetId);

    // Delete from state / model
    let state = await this.loadContainerState(containerName);
    state.widgets = state.widgets.filter(w => w.id !== widgetId);
    await this.saveContainerState(containerName, state);
  }

  /**
   * Asks the plugin service to fetch a widget and returns a created widget state ready to be used.
   *
   * For some special widgets like the news widget, the return value can different as the way to handle scanned
   * "news" urls is different: eg: add the url as a news source but don't add a new widget, if there is already a news widget on the home screeb.
   */
  public async fetchWidgetPluginAndCreate(
    widgetUrl: string,
    silentError = false
  ): Promise<{ widgetState?: WidgetState; newsSourceAdded?: boolean }> {
    Logger.log('widgets', 'Fetching widget plugin at:', widgetUrl);

    try {
      let pluginContent = await this.pluginService.fetchWidgetPlugin(widgetUrl);
      if (!pluginContent) return null;

      let widgetState = this.createWidgetState({
        category: 'app-plugin',
        displayCategories: [DisplayCategories.DAPPS],
        availableInLightweightMode: false,
        plugin: {
          pluginType: 'standard' // standard for now, updated just after
        }
      });

      if (pluginContent.contenttype === 'news') {
        // News widget
        Logger.log('widgets', 'Widget plugin is a news source');

        // Append news source
        await this.newsService.upsertNewsSource(widgetUrl, pluginContent.projectname, pluginContent);

        // Check if there is already a news widget on the home screen. If not, return the widget state as for
        // other widgets. If there is one, just append the news source but don't let the user create a new widget
        let existingNewsWidgetInfo = await this.findInAllContainers(
          widgetState => widgetState.category === 'app-plugin' && widgetState.plugin.pluginType === 'news'
        );
        if (existingNewsWidgetInfo) {
          Logger.log('widgets', 'News widget already exists, only adding the news source');
          return { newsSourceAdded: true };
        } else {
          widgetState.plugin.pluginType = 'news';
          return { widgetState }; // Return a widget state so the caller can create a first news widget
        }
      } else {
        // Just in case, make sure the source was not an existing news source, in case a developer
        // previously used a news plugin type then changed it to something else.
        await this.newsService.checkNewsSources();

        // Save a single plugin url only for non news plugins. For news plugins, the url is added as news source
        widgetState.plugin.url = widgetUrl;
        return { widgetState };
      }
    } catch (e) {
      if (!silentError) {
        let message = GlobalTranslationService.instance.translateInstant('launcher.invalid-widget') + e;
        this.globalNative.errToast(message);
      }
      return null;
    }
  }

  /**
   * Unconditionally fetches the latest JSON content for the given widget.
   * This means one (1 widget = 1 plugin) or more (news plugin type) plugins are refreshed.
   */
  public async refreshWidgetPluginContent(widgetState: WidgetState, silentError = false): Promise<void> {
    let pluginSources: string[] = [];
    if (widgetState.category === 'app-plugin' && widgetState.plugin.pluginType === 'news') {
      // For news widgets, we check all plugin sources (multiple) for freshness.
      pluginSources = this.newsService.getNewsSourceURLs();
    } else {
      // All other plugin widget types have only one source to refresh.
      pluginSources.push(widgetState.plugin.url);
    }

    for (let source of pluginSources) {
      try {
        await this.pluginService.fetchWidgetPlugin(source);
      } catch (e) {
        // silence
      }
    }

    await this.newsService.checkNewsSources();
  }

  /**
   * Refreshes one of more sources depending on the given widget, but only if enough time has elapsed since the
   * previous refresh, based on the delay specific in the widget configuration.
   */
  public async refreshWidgetPluginContentIfRightTime(widgetState: WidgetState): Promise<void> {
    let pluginSources: string[] = [];
    if (widgetState.category === 'app-plugin' && widgetState.plugin.pluginType === 'news') {
      // For news widgets, we check all plugin sources (multiple) for freshness.
      pluginSources = this.newsService.getNewsSourceURLs();
    } else {
      // All other plugin widget types have only one source to refresh.
      pluginSources.push(widgetState.plugin.url);
    }

    for (let source of pluginSources) {
      let config = <PluginConfig<any>>await this.pluginService.getPluginContent(source);
      if (config != null) {
        // in case, the config is null when user signs out.
        const lastFetched = this.pluginService.getLastFetched(source);

        const now = moment();
        const refreshDelaySec = config.refresh || 1 * 24 * 60 * 60; // 1 day by default if not specified

        if (now.subtract(refreshDelaySec, 'seconds').isSameOrAfter(lastFetched)) {
          // Right time to refresh
          try {
            await this.pluginService.fetchWidgetPlugin(source);
          } catch (e) {
            // silence
          }
        }
      }
    }
  }

  private generateDefaultContainerState(widgetContainerName: string): WidgetContainerState {
    let widgets: WidgetState[] = [];

    if (this.lightweightMode) {
      if (widgetContainerName === 'main') {
        widgets.push(this.createBuiltInWidgetState('active-wallet'));
        widgets.push(this.createBuiltInWidgetState('notifications'));
        widgets.push(this.createBuiltInWidgetState('wallet-connect'));
        widgets.push(this.createBuiltInWidgetState('choose-active-network'));
        widgets.push(this.createBuiltInWidgetState('discover-dapps'));
        // widgets.push(this.createBuiltInWidgetState('favorite-apps'));
      }
    } else {
      switch (widgetContainerName) {
        case 'left':
          widgets.push(this.createBuiltInWidgetState('active-network-coin-price'));
          widgets.push(this.createBuiltInWidgetState('recent-apps'));
          widgets.push(this.createBuiltInWidgetState('choose-active-network'));
          widgets.push(this.createBuiltInWidgetState('wallet-connect'));
          widgets.push(this.createPluginWidgetState('news'));
          widgets.push(this.createBuiltInWidgetState('signout'));
          break;
        case 'main':
          widgets.push(this.createBuiltInWidgetState('notifications'));
          widgets.push(this.createBuiltInWidgetState('identity'));
          widgets.push(this.createBuiltInWidgetState('new-red-packets'));
          widgets.push(this.createBuiltInWidgetState('backup-identity'));
          widgets.push(this.createBuiltInWidgetState('active-wallet'));
          widgets.push(this.createBuiltInWidgetState('hive-sync'));
          // widgets.push(this.createBuiltInWidgetState("swap"));
          widgets.push(this.createBuiltInWidgetState('discover-dapps'));
          widgets.push(this.createBuiltInWidgetState('red-packets'));

          // When default container states are regenerated (the very first time essentials is launched,
          // or when user resets his config), we fetch partner plugins asynchronously.
          // We do this only for the "main" container to fetch plugins only once, and this mechanism
          // is asynchronous, meaning that until the widgets are fetched and saved, they won't
          // appear in user's "dapps" panel to be added by the user, but this is ok, as we don't want
          // to block the UI for that.
          void this.fetchPartnerPlugins();

          break;
        case 'right':
          widgets.push(this.createBuiltInWidgetState('cyber-republic'));
          widgets.push(this.createBuiltInWidgetState('elastos-staking'));
          widgets.push(this.createBuiltInWidgetState('elastos-voting'));
          widgets.push(this.createBuiltInWidgetState('contacts'));
          widgets.push(this.createBuiltInWidgetState('hive'));

          // Can't do this... this would force us to fetch plugins when starting essentials for
          // the first time
          // and block the UI during this time. Unless and async mechanism is created to add widgets.
          // For now, just don't do it.
          //widgets.push(...this.getDefaultPartnerPlugins());

          break;
      }
    }

    return {
      widgets
    };
  }

  private fetchPartnerPlugins() {
    for (let partnerPluginUrl of partnerPluginUrls) {
      void this.pluginService.fetchWidgetPlugin(partnerPluginUrl).catch(e => {
        // silence
      });
    }
  }

  /* private getDefaultPartnerPlugins(): WidgetState[] {
        let state = this.createWidgetState({
            category: "app-plugin",
            displayCategories: [DisplayCategories.DAPPS],
            plugin: {
                pluginType: "standard",
                url: "https://ela.city/api/templates/portal"
            }
        })
        return [state];
    } */

  private async resetWidgets(containerName: string) {
    await this.saveContainerState(containerName, this.generateDefaultContainerState(containerName));
    this.onWidgetContainerContentReset.next(containerName);
  }

  /**
   * Restores all containers to their original content
   */
  public async resetAllWidgets() {
    this.componentsInstances = [];
    await this.resetWidgets('left');
    await this.resetWidgets('main');
    await this.resetWidgets('right');
  }

  private async findInAllContainers(
    filter: (widgetState: WidgetState) => boolean
  ): Promise<{ containerName: string; widgetState: WidgetState }> {
    for (let containerName of this.containerNames) {
      let containerState = await this.loadContainerState(containerName);
      for (let widgetState of containerState.widgets) {
        if (filter(widgetState)) return { containerName, widgetState };
      }
    }
    return { containerName: null, widgetState: null };
  }
}
