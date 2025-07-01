function mds_classic(distances, dimensions) {
    dimensions = dimensions || 2;

    // square distances
    var M = numeric.mul(-0.5, numeric.pow(distances, 2));
    //var M = distances;

    // double centre the rows/columns
    function mean(A) { return numeric.div(numeric.add.apply(null, A), A.length); }
    var rowMeans = mean(M),
        colMeans = mean(numeric.transpose(M)),
        totalMean = mean(rowMeans);

    for (var i = 0; i < M.length; ++i) {
        for (var j =0; j < M[0].length; ++j) {
            M[i][j] += totalMean - rowMeans[i] - colMeans[j];
        }
    }

    // take the SVD of the double centred matrix, and return the
    // points from it
    var ret = numeric.svd(M),
        eigenValues = numeric.sqrt(ret.S);

  console.log(`${eigenValues}`)
  console.log(`${ret.U}`)
  console.log(`${ret.U.map(function(row) {numeric.mul(row, eigenValues)})}`)
  console.log(`${eigenValues.length}`)
  return ret.U.map(function(row) {
      const scaled = row.map((value, i) => value * eigenValues[i]);
      return scaled.slice(0, dimensions);
  });
    //return ret.U.map(function(row) {
        //return numeric.mul(row, eigenValues).splice(0, dimensions);
    //});
};
