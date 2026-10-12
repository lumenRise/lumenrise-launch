import Launch from '../../models/Launch';
import TokenImage from '../../models/TokenImage';
import FactoryCursor from '../../models/FactoryCursor';
import AssetIdentity from '../../models/AssetIdentity';
import LaunchPriceSample from '../../models/LaunchPriceSample';

const createLaunchIndexes = async (): Promise<void> => {
  await Promise.all([
    Launch.createIndexes(),
    TokenImage.createIndexes(),
    FactoryCursor.createIndexes(),
    AssetIdentity.createIndexes(),
    LaunchPriceSample.createIndexes(),
  ]);
};

export default createLaunchIndexes;
