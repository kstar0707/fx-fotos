import React, { forwardRef, useImperativeHandle, useRef } from 'react'
import Animated, {
  useSharedValue,
  useAnimatedScrollHandler,
  useAnimatedRef,
  SharedValue,
} from 'react-native-reanimated'

import {
  ImageErrorEventData,
  NativeSyntheticEvent,
  RefreshControlProps,
  ViewStyle,
} from 'react-native'
import RecyclerAssetList, {
  RecyclerAssetListHandler,
} from './recycler-asset-list'
import GridProvider from './grid-provider/gridContext'
import PinchZoom from './grid-provider/pinchZoom'

import { Asset, AssetStory, RecyclerAssetListSection } from '../../types'
import { PinchGestureHandler } from 'react-native-gesture-handler'

interface Props {
  refreshData: () => Promise<void>
  sections: RecyclerAssetListSection[]
  scrollY: SharedValue<number> | undefined
  onSelectedItemsChange?: (assetIds: string[], selectionMode: boolean) => void
  onAssetLoadError?: (error: NativeSyntheticEvent<ImageErrorEventData>) => void
  renderFooter?: () => JSX.Element | JSX.Element[]
  onItemPress?: (section: RecyclerAssetListSection) => void
  onStoryPress?: (story: AssetStory) => void
  contentContainerStyle?: ViewStyle
  refreshControl?: React.ReactElement<RefreshControlProps> | undefined
  externalState: Record<string, Asset>
}
export interface AssetListHandle {
  resetSelectedItems: () => void
  toggleSelectionMode: () => void
  scrollToItem: (item: RecyclerAssetListSection, animated?: boolean) => void
}
// eslint-disable-next-line react/display-name
const AssetList = forwardRef<AssetListHandle, Props>(
  (
    {
      refreshData,
      sections,
      scrollY,
      onSelectedItemsChange,
      onAssetLoadError,
      renderFooter,
      onItemPress,
      onStoryPress,
      contentContainerStyle,
      refreshControl,
      externalState,
    },
    ref,
  ): JSX.Element => {
    const translationY = useSharedValue(0)
    const scrollRefExternal = useAnimatedRef<Animated.ScrollView>()
    const recyclerAssetListRef = useRef<RecyclerAssetListHandler>()
    const pinchZoomRef = useRef<PinchGestureHandler>()
    useImperativeHandle<AssetListHandle>(ref, () => ({
      resetSelectedItems: () => {
        recyclerAssetListRef.current?.resetSelectedItems()
      },
      toggleSelectionMode: () => {
        recyclerAssetListRef.current?.toggleSelectionMode()
      },
      scrollToItem: (item: RecyclerAssetListSection, animated?: boolean) => {
        recyclerAssetListRef.current.scrollToItem(item, animated)
      },
    }))
    const scrollHandler = useAnimatedScrollHandler({
      onScroll: event => {
        translationY.value = event.contentOffset.y

        if (scrollY) scrollY.value = translationY.value
      },
    })

    return (
      <GridProvider>
        <PinchZoom ref={pinchZoomRef}>
          <RecyclerAssetList
            ref={recyclerAssetListRef}
            waitFor={[pinchZoomRef]}
            refreshData={refreshData}
            sections={sections}
            scrollHandler={scrollHandler}
            scrollRef={scrollRefExternal}
            scrollY={scrollY}
            onSelectedItemsChange={onSelectedItemsChange}
            onAssetLoadError={onAssetLoadError}
            renderFooter={renderFooter}
            onItemPress={onItemPress}
            onStoryPress={onStoryPress}
            contentContainerStyle={contentContainerStyle}
            refreshControl={refreshControl}
            externalState={externalState}
          />
        </PinchZoom>
      </GridProvider>
    )
  },
)

export default AssetList
