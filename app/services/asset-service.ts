import { Platform } from 'react-native'
import * as MediaLibrary from 'expo-media-library'
import {
  CameraRoll,
  GetPhotosParams,
} from '@react-native-camera-roll/camera-roll'
import {
  manipulateAsync,
  SaveFormat,
  ImageResult,
} from 'expo-image-manipulator'

import moment from 'moment'
import {
  RecyclerAssetListSection,
  ViewType,
  GroupHeader,
  Library,
  AssetStory,
  Asset,
  PagedInfo,
  MediaTypeValue,
} from '../types'

export const generateThumbnail = async (assets: MediaLibrary.Asset[]) => {
  const result: ImageResult[] = []
  for (let index = 0; index < assets.length; index++) {
    const asset = assets[index]
    if (asset.mediaType === 'photo' && asset.uri) {
      const thumbnail = await manipulateAsync(
        asset.uri,
        [{ resize: { height: 200 } }],
        {
          compress: 1,
          format: SaveFormat.PNG,
          base64: false,
        },
      )
      result.push(thumbnail)
    }
  }
  return result
}

const getAssetStoryCategory = (startTime: number, modificationTime: number) => {
  const diff = (startTime - modificationTime) / (1000 * 60 * 60 * 24)
  const span = 2
  if (diff <= 14) return 'Recently'
  else if (diff > 2 * 30 - span && diff <= 2 * 30 + span) return '2 months ago'
  else if (diff > 3 * 30 - span && diff <= 3 * 30 + span) return '3 months ago'
  else if (diff > 6 * 30 - span && diff <= 6 * 30 + span) return '6 months ago'
  else if (diff > 12 * 30 - span && diff <= 12 * 30 + span) return 'A year ago'
  else if (diff > 24 * 30 - span && diff < 24 * 30 + span) return '2 years ago'
  else if (diff > 36 * 30 - span && diff < 36 * 30 + span)
    return 'More than 3 years'
  return null
}

export const categorizeAssets = (assets: Asset[], storyHighlight = false) => {
  const sections: RecyclerAssetListSection[] = []
  let lastMonth = moment().format('MMMM YYYY')
  let lastDay = null
  let lastMonthHeader: GroupHeader = null
  let lastDayHeader: GroupHeader = null
  const storiesObj: Record<string, MediaLibrary.Asset[]> = {}

  for (const asset of assets) {
    // Make story objects
    // Filter assets to get camera folder
    if (
      __DEV__ ||
      (storyHighlight &&
        asset?.modificationTime &&
        (Platform.OS === 'ios' ||
          asset.uri?.toLowerCase().includes('/dcim/camera/')))
    ) {
      const categoryName = getAssetStoryCategory(
        assets?.[0].modificationTime,
        asset.modificationTime,
      )
      if (categoryName && !storiesObj[categoryName])
        storiesObj[categoryName] = []
      if (categoryName) storiesObj[categoryName].push(asset)
    }

    const times = moment(asset.modificationTime).format(
      'MMMM YYYY|dddd, MMM D, YYYY',
    )
    const month = times.split('|')[0]
    const day = times.split('|')[1]

    // Create Month group sections
    if (month !== lastMonth) {
      lastMonth = month
      lastMonthHeader = {
        title: month,
        date: new Date(asset.modificationTime),
        subGroupIds: [],
      }
      sections.push({
        id: month,
        data: {
          ...lastMonthHeader,
        },
        type: ViewType.MONTH,
      })
    }
    // Create day group section
    if (day !== lastDay) {
      lastDay = day
      lastDayHeader = {
        title: day,
        date: new Date(asset.modificationTime),
        subGroupIds: [],
      }
      const daySection: RecyclerAssetListSection = {
        id: `${month}-${day}`,
        data: {
          ...lastDayHeader,
        },
        type: ViewType.DAY,
      }
      sections.push(daySection)
      if (lastMonthHeader) {
        lastDayHeader.subGroupIds.push(daySection.id)
      }
    }
    // Add assets
    const assetSection: RecyclerAssetListSection = {
      id: asset.id,
      data: asset,
      type: ViewType.ASSET,
    }
    sections.push(assetSection)
    if (lastDayHeader) {
      lastDayHeader.subGroupIds.push(assetSection.id)
    }
  }

  if (storyHighlight) {
    // Create story section
    const storySection: RecyclerAssetListSection = {
      id: 'story_highlight',
      type: ViewType.STORY,
      data: Object.keys(storiesObj)
        // Sort stories based on first asset
        .sort(
          (a, b) =>
            storiesObj[b]?.[0].modificationTime -
            storiesObj[a]?.[0].modificationTime,
        )
        .map(
          (key, index) =>
            ({
              id: `story_${index}_${storiesObj[key]?.length}`,
              data: storiesObj[key],
              title: key,
            } as AssetStory),
        ),
    }
    return [storySection, ...sections]
  }

  return [...sections]
}
export const getLibraries = (assets: MediaLibrary.Asset[]): Library[] => {
  const librariesObj: Record<string, MediaLibrary.Asset[]> = {}

  // Group assets based on last directory name
  for (const asset of assets) {
    if (!asset || !asset.uri) continue
    const uriParts = asset?.uri?.split('/')
    const title = uriParts?.[uriParts.length - 2]
    if (!librariesObj[title]) librariesObj[title] = []
    librariesObj[title].push(asset)
  }

  const libraries = Object.keys(librariesObj).map(
    title =>
      ({
        title,
        assets: librariesObj[title],
      } as Library),
  )

  return libraries
}

export const getAssets = async (
  params: GetPhotosParams,
): Promise<PagedInfo<Asset>> => {
  try {
    const medias = await CameraRoll.getPhotos(params)
    const assets = medias.edges.map<Asset>(photo => ({
      id: photo?.node?.image?.uri,
      filename: photo?.node?.image?.filename || '',
      uri: photo?.node?.image?.uri,
      height: photo?.node?.image?.height,
      width: photo?.node?.image?.width,
      creationTime: photo?.node?.timestamp * 1000,
      modificationTime:
        photo?.node?.modified * 1000 || photo?.node?.timestamp * 1000,
      duration: photo?.node?.image?.playableDuration || 0,
      mediaType: mimeToMediaType(photo?.node?.type),
      albumId: photo?.node?.group_name,
      location: photo?.node?.location,
      fileSize: photo?.node?.image.fileSize,
    }))
    return {
      assets,
      hasNextPage: medias.page_info.has_next_page,
      endCursor: medias.page_info.end_cursor,
    }
  } catch (error) {
    console.error('error', error)
    throw error
  }
}
export const deleteAssets = async (photoUris: string[]): Promise<void> => {
  try {
    await CameraRoll.deletePhotos(photoUris)
  } catch (error) {
    console.error('error', error)
    throw error
  }
}

export const getMediaInfo = async (
  asset: Asset,
): Promise<MediaLibrary.AssetInfo> => {
  const info = await MediaLibrary.getAssetInfoAsync(asset)
  return info
}

export const mimeToMediaType = (mime: string): MediaTypeValue => {
  const mimeType = mime?.split('/')?.[0]
  switch (mimeType) {
    case 'image':
      return 'photo'
    case 'video':
      return 'video'
    case 'audio':
      return 'audio'
    default:
      return 'unknown'
  }
}
