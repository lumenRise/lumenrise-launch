import Launch from '../../models/Launch';
import LaunchName from '../../models/LaunchName';
import TokenImage from '../../models/TokenImage';
import LaunchHolder from '../../models/LaunchHolder';
import FactoryCursor from '../../models/FactoryCursor';
import AssetIdentity from '../../models/AssetIdentity';
import LaunchPriceSample from '../../models/LaunchPriceSample';
import LaunchHolderRefreshJob from '../../models/LaunchHolderRefreshJob';

const createLaunchIndexes = async (): Promise<void> => {
  await Promise.all([
    Launch.createIndexes(),
    LaunchName.createIndexes(),
    LaunchHolder.createIndexes(),
    LaunchHolderRefreshJob.createIndexes(),
    TokenImage.createIndexes(),
    FactoryCursor.createIndexes(),
    AssetIdentity.createIndexes(),
    LaunchPriceSample.createIndexes(),
  ]);
};

export default createLaunchIndexes;
